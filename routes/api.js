import { Router } from 'express';
import { askGemini } from '../gemini.js';
import { lerPdfDeBuffer } from '../pdf.js';
import { criarDocx } from '../word.js';
import {
  dbCases,
  dbChat,
  dbLawyers,
  dbWebUsers,
  getChatStats,
} from '../database.js';
import { config } from '../config.js';
import { isAdminRequestAuthorized } from '../lib/adminAuth.js';
import { SPECIALIZATIONS } from '../lib/specializations.js';
import { isValidBrazilianState, parseOab } from '../lib/lawyers.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  parseCookies,
  serializeSessionCookie,
  verifyPassword,
  verifySessionToken,
} from '../lib/webAuth.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PDF_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

function toPublicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name || '',
    role: user.role || 'user',
  };
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const decoded = verifySessionToken(cookies[SESSION_COOKIE_NAME], config.sessionSecret);
  if (!decoded?.userId) {
    sendError(res, 401, 'Sessão inválida ou expirada. Faça login novamente.');
    return;
  }
  req.webUserId = decoded.userId;
  next();
}

function requireAdminKey(req, res, next) {
  if (!config.adminPanelKey) {
    sendError(res, 503, 'Painel administrativo desabilitado. Defina ADMIN_PANEL_KEY no ambiente.');
    return;
  }
  if (!isAdminRequestAuthorized(req, config.adminPanelKey)) {
    sendError(res, 401, 'Acesso negado. Informe a chave correta via header x-admin-key.');
    return;
  }
  next();
}

function parseGeneratedDocument(reply) {
  if (typeof reply !== 'string' || !reply.startsWith('[GERAR_DOC]')) return null;
  const lines = reply.split('\n');
  const titulo = lines[1]?.trim() || 'Documento Jurídico';
  const conteudo = lines.slice(2).join('\n').trim();
  return { title: titulo, content: conteudo };
}

function isValidSpecializationCode(code) {
  return SPECIALIZATIONS.some((item) => item.code === code);
}

/**
 * Router da API REST consumida pelo frontend web (`web/`). Reaproveita a
 * mesma lógica de domínio usada pelo bot do Telegram (gemini.js, pdf.js,
 * word.js, database.js, lib/*), apenas adaptando a camada de transporte
 * (JSON + sessão em cookie) em vez do protocolo do Telegram.
 */
export function createApiRouter() {
  const router = Router();

  // ---------- Autenticação ----------
  router.post('/auth/register', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim().slice(0, 120);

    if (!EMAIL_REGEX.test(email)) return sendError(res, 400, 'Informe um e-mail válido.');
    if (password.length < 8) return sendError(res, 400, 'A senha deve ter ao menos 8 caracteres.');

    const existing = await dbWebUsers.findByEmail(email);
    if (existing) return sendError(res, 409, 'Já existe uma conta com este e-mail.');

    const user = await dbWebUsers.create(email, hashPassword(password), name);
    if (!user) return sendError(res, 503, 'Não foi possível criar a conta. Verifique se o MongoDB está configurado.');

    const token = createSessionToken({ userId: String(user._id) }, config.sessionSecret, SESSION_TTL_MS);
    res.setHeader('Set-Cookie', serializeSessionCookie(SESSION_COOKIE_NAME, token, { maxAgeMs: SESSION_TTL_MS }));
    res.status(201).json({ user: toPublicUser(user) });
  });

  router.post('/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await dbWebUsers.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendError(res, 401, 'E-mail ou senha inválidos.');
    }

    const token = createSessionToken({ userId: String(user._id) }, config.sessionSecret, SESSION_TTL_MS);
    res.setHeader('Set-Cookie', serializeSessionCookie(SESSION_COOKIE_NAME, token, { maxAgeMs: SESSION_TTL_MS }));
    res.json({ user: toPublicUser(user) });
  });

  router.post('/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', clearSessionCookie(SESSION_COOKIE_NAME));
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, async (req, res) => {
    const user = await dbWebUsers.findById(req.webUserId);
    if (!user) return sendError(res, 404, 'Usuário não encontrado.');
    res.json({ user: toPublicUser(user) });
  });

  // ---------- Especialidades ----------
  router.get('/specializations', (_req, res) => {
    res.json({
      specializations: SPECIALIZATIONS.map(({ code, name, description, icon }) => ({ code, name, description, icon })),
    });
  });

  // ---------- Chat com IA ----------
  router.post('/chat', requireAuth, async (req, res) => {
    const message = String(req.body?.message || '').trim();
    const caseId = req.body?.caseId || undefined;
    if (!message) return sendError(res, 400, 'Informe uma mensagem.');

    let specialization;
    if (caseId) {
      const caseDoc = await dbCases.getCaseForUser(req.webUserId, caseId);
      if (!caseDoc) return sendError(res, 404, 'Caso não encontrado.');
      specialization = caseDoc.specialization || undefined;
    }

    const reply = await askGemini(req.webUserId, message, caseId, specialization);
    const generatedDocument = parseGeneratedDocument(reply);
    res.json({
      reply: generatedDocument ? null : reply,
      generatedDocument,
    });
  });

  // ---------- Casos ----------
  router.get('/cases', requireAuth, async (req, res) => {
    res.json({ cases: await dbCases.listCases(req.webUserId) });
  });

  router.post('/cases', requireAuth, async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const specialization = req.body?.specialization;
    if (specialization && !isValidSpecializationCode(specialization)) {
      return sendError(res, 400, 'Especialidade inválida.');
    }

    const created = await dbCases.createCase(req.webUserId, title, specialization);
    if (!created) return sendError(res, 503, 'Não foi possível criar o caso. Verifique se o MongoDB está configurado.');
    res.status(201).json({ case: created });
  });

  router.patch('/cases/:id/select', requireAuth, async (req, res) => {
    const updated = await dbCases.setActiveCaseById(req.webUserId, req.params.id);
    if (!updated) return sendError(res, 404, 'Caso não encontrado.');
    res.json({ case: updated });
  });

  router.get('/cases/:id/messages', requireAuth, async (req, res) => {
    const caseDoc = await dbCases.getCaseForUser(req.webUserId, req.params.id);
    if (!caseDoc) return sendError(res, 404, 'Caso não encontrado.');

    const history = await dbChat.getHistory(req.webUserId, req.params.id, config.historyLimit);
    res.json({
      messages: history.map(({ role, parts }) => ({ role, text: parts?.[0]?.text || '' })),
    });
  });

  // ---------- Documentos ----------
  router.post('/documents/analyze-pdf', requireAuth, async (req, res) => {
    const { filename, contentBase64, question, caseId } = req.body || {};
    if (!contentBase64 || typeof contentBase64 !== 'string') {
      return sendError(res, 400, 'Envie o arquivo em contentBase64.');
    }

    let buffer;
    try {
      buffer = Buffer.from(contentBase64, 'base64');
    } catch {
      return sendError(res, 400, 'Conteúdo base64 inválido.');
    }

    if (buffer.length === 0 || buffer.length > MAX_PDF_UPLOAD_BYTES) {
      return sendError(res, 400, `O arquivo deve ter entre 1 byte e ${MAX_PDF_UPLOAD_BYTES / (1024 * 1024)}MB.`);
    }
    if (filename && !/\.pdf$/i.test(String(filename))) {
      return sendError(res, 400, 'Apenas arquivos .pdf são aceitos.');
    }

    const pdfText = await lerPdfDeBuffer(buffer);
    if (!pdfText) {
      return sendError(res, 422, 'Não foi possível ler este PDF. Verifique se ele não está protegido, corrompido ou baseado apenas em imagens.');
    }

    let specialization;
    if (caseId) {
      const caseDoc = await dbCases.getCaseForUser(req.webUserId, caseId);
      if (!caseDoc) return sendError(res, 404, 'Caso não encontrado.');
      specialization = caseDoc.specialization || undefined;
    }

    const textoParaIA = `O usuário enviou um documento PDF. Analise o conteúdo abaixo e responda à dúvida do usuário.\n\nCONTEÚDO DO PDF:\n${pdfText}\n\nDÚVIDA DO USUÁRIO:\n${String(question || '').trim() || '(análise geral do documento)'}`;
    const reply = await askGemini(req.webUserId, textoParaIA, caseId, specialization);
    const generatedDocument = parseGeneratedDocument(reply);
    res.json({
      reply: generatedDocument ? null : reply,
      generatedDocument,
    });
  });

  router.post('/documents/generate', requireAuth, async (req, res) => {
    const title = String(req.body?.title || '').trim().slice(0, 200) || 'Documento Jurídico';
    const content = String(req.body?.content || '').trim();
    if (!content) return sendError(res, 400, 'Informe o conteúdo do documento.');

    const buffer = await criarDocx(title, content);
    const safeName = title.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().slice(0, 80) || 'documento';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
    res.send(buffer);
  });

  // ---------- Advogados ----------
  router.get('/lawyers', async (req, res) => {
    const specialization = req.query?.specialization;
    if (specialization && !isValidSpecializationCode(specialization)) {
      return sendError(res, 400, 'Especialidade inválida.');
    }
    const state = req.query?.state ? String(req.query.state).toUpperCase() : undefined;
    const lawyers = specialization ? await dbLawyers.findRecommendations(specialization, state) : [];
    res.json({ lawyers });
  });

  router.post('/lawyers/register', requireAuth, async (req, res) => {
    const { name, oab, specializations, state, city, phone, bio, telegramUsername } = req.body || {};
    const parsedOab = parseOab(oab);
    if (!name || String(name).trim().length < 3) return sendError(res, 400, 'Informe o nome completo.');
    if (!parsedOab) return sendError(res, 400, 'Número da OAB inválido. Use o formato UF123456.');
    if (!Array.isArray(specializations) || !specializations.length || !specializations.every(isValidSpecializationCode)) {
      return sendError(res, 400, 'Selecione ao menos uma especialidade válida.');
    }
    if (!isValidBrazilianState(state)) return sendError(res, 400, 'UF inválida.');
    if (!city || String(city).trim().length < 2) return sendError(res, 400, 'Informe a cidade.');
    if (!phone || String(phone).trim().length < 8) return sendError(res, 400, 'Informe um telefone válido.');
    if (!bio || String(bio).trim().length < 10) return sendError(res, 400, 'Escreva uma breve bio (mínimo 10 caracteres).');

    const lawyer = await dbLawyers.register({
      telegramId: `web-${req.webUserId}`,
      name: String(name).trim(),
      oabNumber: parsedOab.number,
      oabState: parsedOab.state,
      specializations,
      location: { state: String(state).toUpperCase(), city: String(city).trim() },
      phone: String(phone).trim(),
      bio: String(bio).trim(),
      telegramUsername: telegramUsername ? String(telegramUsername).trim() : '',
    });
    if (!lawyer) return sendError(res, 503, 'Não foi possível concluir o cadastro. Tente novamente.');
    res.status(201).json({ lawyer });
  });

  // ---------- Administração ----------
  router.get('/admin/stats', requireAdminKey, async (_req, res) => {
    res.json(await getChatStats());
  });

  router.get('/admin/lawyers', requireAdminKey, async (_req, res) => {
    res.json({ lawyers: await dbLawyers.listForAdmin() });
  });

  router.patch('/admin/lawyers/:id/status', requireAdminKey, async (req, res) => {
    const lawyer = await dbLawyers.setStatus(req.params.id, req.body?.status, req.ip);
    if (!lawyer) return sendError(res, 400, 'Transição inválida ou advogado não encontrado.');
    res.json({ lawyer });
  });

  return router;
}
