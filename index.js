import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { askGemini } from './gemini.js';
import { lerPdfDoTelegram } from './pdf.js';
import { criarDocx } from './word.js';
import {
  conectarBanco,
  dbChat,
  dbCases,
  dbUsers,
  dbLawyers,
  dbReferrals,
  getChatStats,
} from './database.js';
import { config, validateConfig } from './config.js';
import { isValidWebhookSecret } from './lib/webhookAuth.js';
import { createRateLimiter } from './lib/rateLimiter.js';
import { createUpdateDeduplicator } from './lib/dedup.js';
import { withRetry } from './lib/retry.js';
import { getSpecialization, parseSpecializations, SPECIALIZATIONS, isComplexLegalQuestion } from './lib/specializations.js';
import {
  createLawyerDashboardToken,
  isValidBrazilianState,
  parseOab,
  verifyLawyerDashboardToken,
} from './lib/lawyers.js';

validateConfig();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;

const rateLimiter = createRateLimiter({
  limit: config.rateLimitPerMinute,
  windowMs: config.rateLimitWindowMs,
});
rateLimiter.start();

const updateDeduplicator = createUpdateDeduplicator();
const lawyerRegistration = new Map();

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAdminPage(stats, adminKey, lawyers) {
  return `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Painel Administrativo | Bot Advogado</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px; }
        .container { max-width: 900px; margin: 0 auto; }
        .card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        h1 { margin-top: 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
        .stat { background: #1e293b; border-radius: 10px; padding: 18px; }
        .label { color: #94a3b8; font-size: 12px; text-transform: uppercase; }
        .value { font-size: 28px; font-weight: bold; margin-top: 8px; }
        button { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 12px 18px; cursor: pointer; }
        .muted { color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>📊 Painel Administrativo</h1>
          <p class="muted">Bot: ${config.botName}</p>
        </div>

        <div class="grid">
          <div class="stat">
            <div class="label">Mensagens salvas</div>
            <div class="value">${stats.totalMessages}</div>
          </div>
          <div class="stat">
            <div class="label">Usuários distintos</div>
            <div class="value">${stats.uniqueUsers}</div>
          </div>
          <div class="stat">
            <div class="label">Última mensagem</div>
            <div class="value">${stats.lastUserMessageAt ? new Date(stats.lastUserMessageAt).toLocaleString('pt-BR') : 'Sem dados'}</div>
          </div>
        </div>

        <div class="card">
          <h2>⚙️ Configuração</h2>
          <p>Admin IDs: ${config.adminUserIds.length ? config.adminUserIds.join(', ') : 'Nenhum usuário configurado'}</p>
          <p>Taxa limite: ${config.rateLimitPerMinute} msg/min</p>
          <p>URL pública: ${config.publicUrl}</p>
        </div>

        <div class="card">
          <h2>⚖️ Verificação de advogados</h2>
          ${lawyers.length ? lawyers.map((lawyer) => `
            <div style="border-top: 1px solid #334155; padding: 14px 0">
              <strong>${escapeHtmlAttribute(lawyer.name)}</strong>
              <span class="muted"> — OAB ${escapeHtmlAttribute(lawyer.oabNumber)}</span>
              <p class="muted">${escapeHtmlAttribute(lawyer.specializations.join(', '))} · ${escapeHtmlAttribute(lawyer.location.city)}, ${escapeHtmlAttribute(lawyer.location.state)} · ${escapeHtmlAttribute(lawyer.status)}</p>
              ${lawyer.status === 'pending_verification' ? `<form method="POST" action="/admin/lawyers/${lawyer._id}/status">
                ${adminKey ? `<input type="hidden" name="key" value="${adminKey}" />` : ''}
                <input type="hidden" name="status" value="verified" />
                <button type="submit">Verificar OAB</button>
              </form>` : ''}
              ${lawyer.status === 'verified' ? `<form method="POST" action="/admin/lawyers/${lawyer._id}/status">
                ${adminKey ? `<input type="hidden" name="key" value="${adminKey}" />` : ''}
                <input type="hidden" name="status" value="active" />
                <button type="submit">Ativar perfil</button>
              </form>` : ''}
            </div>`).join('') : '<p class="muted">Nenhum advogado aguardando verificação ou ativação.</p>'}
        </div>

        <div class="card">
          <h2>🧹 Ações</h2>
          <p class="muted">Ação destrutiva: remove permanentemente o histórico de conversas de todos os usuários. Digite <strong>CONFIRMAR</strong> para habilitar.</p>
          <form method="POST" action="/admin/clear-history" onsubmit="return confirm('Tem certeza? Esta ação apaga TODO o histórico e não pode ser desfeita.');">
            ${adminKey ? `<input type="hidden" name="key" value="${adminKey}" />` : ''}
            <input type="text" name="confirm" placeholder="Digite CONFIRMAR" required style="margin-right: 10px; padding: 8px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0;" />
            <button type="submit">Limpar todo o histórico de conversas</button>
          </form>
        </div>
      </div>
    </body>
  </html>`;
}

function renderLawyerDashboard(data) {
  const { lawyer, referrals, totalReferrals } = data;
  const list = referrals.length
    ? referrals.map((referral) => {
      const contact = referral.userConsent
        ? `${escapeHtmlAttribute(referral.contact?.name || 'Usuário')}${referral.contact?.telegramUsername ? ` · @${escapeHtmlAttribute(referral.contact.telegramUsername)}` : ''}`
        : 'Contato não compartilhado (sem consentimento)';
      return `<li><strong>${escapeHtmlAttribute(referral.specialization)}</strong> — ${escapeHtmlAttribute(referral.status)} — ${new Date(referral.createdAt).toLocaleDateString('pt-BR')}<br><span class="muted">${contact}</span>
        ${referral.status !== 'converted' ? `<form method="POST" action="/admin/lawyer-dashboard/convert">
          <input type="hidden" name="token" value="${escapeHtmlAttribute(data.token)}" />
          <input type="hidden" name="referralId" value="${escapeHtmlAttribute(referral._id)}" />
          <button type="submit">Marcar como convertida</button>
        </form>` : ''}</li>`;
    }).join('')
    : '<li class="muted">Nenhuma indicação neste mês.</li>';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Painel do advogado</title>
    <style>body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px}.container{max-width:850px;margin:auto}.card{background:#111827;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:18px}.muted{color:#94a3b8}button{background:#2563eb;color:white;border:0;border-radius:6px;padding:8px 12px;margin-top:8px}li{padding:12px 0;border-bottom:1px solid #334155}</style></head><body><main class="container">
    <section class="card"><h1>⚖️ Painel do advogado</h1><p><strong>${escapeHtmlAttribute(lawyer.name)}</strong> · OAB ${escapeHtmlAttribute(lawyer.oabNumber)}</p>
      <p>${escapeHtmlAttribute(lawyer.specializations.join(', '))}</p><p>${escapeHtmlAttribute(lawyer.location.city)}, ${escapeHtmlAttribute(lawyer.location.state)}</p><p>Status: ${escapeHtmlAttribute(lawyer.status)}</p></section>
    <section class="card"><h2>Indicações</h2><p>Total: ${totalReferrals} · Recebidas neste mês: ${data.referralsThisMonth} · Contatadas/conversões: ${data.conversionAttempts}</p><ul>${list}</ul></section>
    <section class="card"><h2>Contato</h2><p>${escapeHtmlAttribute(lawyer.phone)}${lawyer.telegramUsername ? ` · @${escapeHtmlAttribute(lawyer.telegramUsername)}` : ''}</p><p>${escapeHtmlAttribute(lawyer.bio)}</p><p class="muted">Dados de contato dos usuários aparecem somente após consentimento explícito.</p></section>
  </main></body></html>`;
}
function getProvidedAdminKey(req) {
  const headerKey = req.headers['x-admin-key'];
  const queryKey = req.query.key;
  const bodyKey = req.body?.key;

  if (!headerKey && (queryKey || bodyKey)) {
    console.warn('[ADMIN] Chave recebida via query/body. Prefira o header x-admin-key para evitar exposição em logs/histórico do navegador.');
  }

  return headerKey || queryKey || bodyKey || '';
}

function ensureAdminPanelAccess(req, res) {
  if (!config.adminPanelKey) {
    res.status(503).send('Painel administrativo desabilitado. Defina ADMIN_PANEL_KEY no ambiente.');
    return false;
  }

  const providedKey = getProvidedAdminKey(req);
  if (providedKey !== config.adminPanelKey) {
    res.status(401).send('Acesso negado. Informe a chave correta via header x-admin-key (recomendado) ou no parâmetro ?key=... (compatibilidade).');
    return false;
  }

  return true;
}

async function sendMessage(chatId, text, options = {}) {
  const chunks = String(text || 'Não foi possível gerar uma resposta.').match(/[\s\S]{1,4000}/g) || [];
  for (const chunk of chunks) {
    await withRetry(() => axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: chunk,
      ...options,
    }, { timeout: 15000 }), { retries: 1, baseDelayMs: 400 });
  }
}

async function sendChatAction(chatId, action = 'typing') {
  try {
    await withRetry(() => axios.post(`${TELEGRAM_API}/sendChatAction`, {
      chat_id: chatId,
      action,
    }, { timeout: 8000 }), { retries: 1, baseDelayMs: 300 });
  } catch (error) {
    console.error('[ERRO TELEGRAM] Falha ao enviar indicador de digitação:', error.message);
  }
}

async function withTypingIndicator(chatId, task) {
  await sendChatAction(chatId, 'typing');
  const interval = setInterval(() => {
    sendChatAction(chatId, 'typing');
  }, 4000);

  try {
    return await task();
  } finally {
    clearInterval(interval);
  }
}

function sanitizeFileName(name) {
  return String(name || 'documento_juridico')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'documento_juridico';
}

function getCommand(text) {
  return text?.trim().split(/\s+/)[0]?.toLowerCase().split('@')[0];
}

function getCommandArgs(text) {
  return String(text || '').trim().split(/\s+/).slice(1).join(' ').trim();
}

function isRateLimited(chatId) {
  return rateLimiter.isRateLimited(chatId);
}

function isAdmin(chatId) {
  return config.adminUserIds.includes(String(chatId));
}

function userDisplayName(from = {}) {
  return [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 120);
}

function parseLocation(text) {
  const match = String(text || '').trim().match(/^([A-Za-z]{2})\s*[, -]\s*(.+)$/);
  if (!match || !isValidBrazilianState(match[1]) || match[2].trim().length < 2 || match[2].trim().length > 100) return null;
  return { state: match[1].toUpperCase(), city: match[2].trim() };
}

function parsePhone(text) {
  const value = String(text || '').trim();
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`;
  return digits.length <= 15 && digits.length >= 12 ? `+${digits}` : null;
}

async function sendLawyerRecommendations(chatId, userId, preferredState) {
  const user = await dbUsers.getUser(userId);
  const activeCase = await dbCases.getActiveCase(userId);
  const specialization = user?.specialization || activeCase?.specialization;
  if (!specialization) {
    await sendMessage(chatId, 'ℹ️ Selecione sua área com /especialidade antes de buscar advogados.');
    return;
  }

  const lawyers = await dbLawyers.findRecommendations(specialization, preferredState || user?.location?.state);
  if (!lawyers.length) {
    await sendMessage(chatId, `ℹ️ Ainda não há advogados ativos em ${getSpecialization(specialization)?.name || specialization}.`);
    return;
  }

  const entries = [];
  const keyboard = [];
  for (const [index, lawyer] of lawyers.entries()) {
    const referral = await dbReferrals.create(userId, lawyer._id, specialization);
    if (!referral) continue;
    entries.push(`${index + 1}️⃣ ${lawyer.name}\n📍 ${lawyer.location.city}, ${lawyer.location.state}\n⭐ ${getSpecialization(specialization)?.name || specialization}\n📞 ${lawyer.phone}\n💬 ${lawyer.bio}`);
    keyboard.push([{ text: `Enviar mensagem · ${lawyer.name}`.slice(0, 64), callback_data: `referral_contact:${referral._id}` }]);
  }

  if (!keyboard.length) {
    await sendMessage(chatId, '⚠️ Não foi possível registrar as indicações agora. Tente novamente mais tarde.');
    return;
  }
  await sendMessage(chatId, `⚖️ ADVOGADOS RECOMENDADOS\n\n${entries.join('\n\n')}\n\nAo escolher, você poderá consentir ou não com o compartilhamento do seu contato.`, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function continueLawyerRegistration(chatId, text, message) {
  const registration = lawyerRegistration.get(String(chatId));
  if (!registration) return false;
  const value = String(text || '').trim();

  switch (registration.step) {
    case 'name':
      if (value.length < 3 || value.length > 120) {
        await sendMessage(chatId, 'Informe seu nome completo (3 a 120 caracteres).');
        return true;
      }
      registration.profile.name = value;
      registration.step = 'oab';
      await sendMessage(chatId, 'Informe sua OAB com a UF, por exemplo SP123456:');
      return true;
    case 'oab': {
      const oab = parseOab(value);
      if (!oab) {
        await sendMessage(chatId, 'Formato não reconhecido. Informe UF e número da OAB (ex.: SP123456).');
        return true;
      }
      registration.profile.oabNumber = oab.number;
      registration.profile.oabState = oab.state;
      registration.step = 'specializations';
      await sendMessage(chatId, `Informe as áreas separadas por vírgula (número ou código):\n${SPECIALIZATIONS.map((item, index) => `${index + 1}. ${item.name}`).join('\n')}`);
      return true;
    }
    case 'specializations': {
      const specializations = parseSpecializations(value);
      if (!specializations.length) {
        await sendMessage(chatId, 'Selecione ao menos uma especialidade usando os números ou códigos listados.');
        return true;
      }
      registration.profile.specializations = specializations;
      registration.step = 'location';
      await sendMessage(chatId, 'Informe seu estado e cidade (ex.: SP, São Paulo):');
      return true;
    }
    case 'location': {
      const location = parseLocation(value);
      if (!location) {
        await sendMessage(chatId, 'Localização inválida. Informe uma UF brasileira e a cidade (ex.: RJ, Niterói).');
        return true;
      }
      registration.profile.location = location;
      registration.step = 'phone';
      await sendMessage(chatId, 'Informe um telefone de contato com DDD:');
      return true;
    }
    case 'phone': {
      const phone = parsePhone(value);
      if (!phone) {
        await sendMessage(chatId, 'Telefone inválido. Informe entre 10 e 15 dígitos, incluindo DDI se aplicável.');
        return true;
      }
      registration.profile.phone = phone;
      registration.step = 'bio';
      await sendMessage(chatId, 'Escreva uma breve descrição da sua experiência (até 500 caracteres):');
      return true;
    }
    case 'bio':
      if (value.length < 10 || value.length > 500) {
        await sendMessage(chatId, 'A descrição deve ter entre 10 e 500 caracteres.');
        return true;
      }
      registration.profile.bio = value;
      registration.step = 'telegramUsername';
      await sendMessage(chatId, 'Informe seu usuário do Telegram (ex.: @dra_maria) ou envie - para deixar em branco:');
      return true;
    case 'telegramUsername': {
      const username = value === '-' ? '' : value.replace(/^@/, '');
      if (username && !/^[A-Za-z0-9_]{5,32}$/.test(username)) {
        await sendMessage(chatId, 'Usuário inválido. Informe um username de 5 a 32 caracteres ou envie -.');
        return true;
      }
      const profile = {
        ...registration.profile,
        telegramId: String(chatId),
        telegramUsername: username,
      };
      lawyerRegistration.delete(String(chatId));
      const lawyer = await dbLawyers.register(profile);
      await sendMessage(chatId, lawyer
        ? `✅ Cadastro recebido. Seu perfil está como ${lawyer.status} e será revisado pela administração antes de aparecer nas recomendações.`
        : '⚠️ Não foi possível concluir o cadastro. Verifique se já existe um perfil com esta conta ou tente novamente mais tarde.');
      return true;
    }
    default:
      lawyerRegistration.delete(String(chatId));
      return false;
  }
}

async function handleCommand(chatId, command, text, message = {}) {
  switch (command) {
    case '/start':
      await sendMessage(chatId, `⚖️ Olá! Sou o ${config.botName}. Envie sua dúvida, um PDF para análise ou use /help para ver os comandos.\n\nAviso: as respostas são informativas e não substituem orientação de um advogado.`);
      return true;

    case '/help':
      await sendMessage(chatId, '📚 Comandos disponíveis:\n/start — iniciar o atendimento\n/help — mostrar esta ajuda\n/status — verificar se o bot está online\n/sobre — informações do bot\n/documentos — tipos de documentos que posso ajudar\n/especialidade — escolher sua área jurídica\n/minha_especialidade — ver sua área\n/minha_localizacao <UF, cidade> — informar localização para recomendações\n/advogados — ver advogados recomendados\n/novo_caso [título] — criar um novo caso e torná-lo ativo\n/casos — listar seus casos e ver qual está ativo\n/caso <número> — trocar o caso ativo\n/registrar_advogado — cadastrar-se como advogado\n/meu_perfil — ver perfil e estatísticas de advogado\n/editar_perfil <campo> <valor> — editar bio, telefone, cidade, estado ou Telegram\n/dashboard_advogado — abrir o painel de indicações\n/marcar_indicacao <id> convertida — registrar conversão manualmente\n/cancelar — cancelar um cadastro em andamento\n/resetar — limpar seu histórico (admin)\n/admin — acessar painel (admin)');
      return true;

    case '/status':
      await sendMessage(chatId, '✅ Bot online e pronto para atender.');
      return true;

    case '/sobre':
      await sendMessage(chatId, `⚖️ ${config.botName}\nAssistente jurídico com análise de texto/PDF e geração de documentos.\n\nAs respostas são educacionais e não constituem consulta oficial.`);
      return true;

    case '/documentos':
      await sendMessage(chatId, '📄 Documentos que posso auxiliar a redigir:\n- Procuração\n- Contrato\n- Petição\n- Requerimento\n- Carta\n- Declaração\n- Termo de outorga\n\nBasta solicitar! 📝');
      return true;

    case '/especialidade': {
      const selected = getSpecialization(getCommandArgs(text));
      if (selected) {
        const saved = await dbUsers.setSpecialization(chatId, selected.code, userDisplayName(message.from));
        await sendMessage(chatId, saved
          ? `✅ Sua especialidade agora é ${selected.name}. As próximas respostas e novos casos usarão esse contexto.`
          : '⚠️ Não foi possível salvar sua especialidade. Verifique se o banco de dados está disponível.');
        return true;
      }
      await sendMessage(chatId, `⚖️ Escolha sua área jurídica:\n${SPECIALIZATIONS.map((item, index) => `${index + 1}. ${item.icon} ${item.name} — ${item.description}`).join('\n')}`, {
        reply_markup: {
          inline_keyboard: SPECIALIZATIONS.map((item) => [{ text: `${item.icon} ${item.name}`, callback_data: `specialization:${item.code}` }]),
        },
      });
      return true;
    }

    case '/minha_especialidade': {
      const user = await dbUsers.getUser(chatId);
      const activeCase = await dbCases.getActiveCase(chatId);
      const selected = getSpecialization(user?.specialization || activeCase?.specialization);
      await sendMessage(chatId, selected
        ? `⚖️ Sua especialidade atual é ${selected.name}. Use /especialidade para alterá-la.`
        : 'ℹ️ Você ainda não escolheu uma área. Use /especialidade para começar.');
      return true;
    }

    case '/minha_localizacao': {
      const location = parseLocation(getCommandArgs(text));
      if (!location) {
        await sendMessage(chatId, 'ℹ️ Use /minha_localizacao <UF, cidade>, por exemplo /minha_localizacao SP, São Paulo.');
        return true;
      }
      const saved = await dbUsers.setLocation(chatId, location.state, location.city);
      await sendMessage(chatId, saved
        ? `📍 Localização salva: ${location.city}, ${location.state}.`
        : '⚠️ Não foi possível salvar sua localização. Verifique o banco de dados.');
      return true;
    }

    case '/advogados': {
      const preferredState = getCommandArgs(text).toUpperCase();
      if (preferredState && !isValidBrazilianState(preferredState)) {
        await sendMessage(chatId, 'ℹ️ Informe uma UF brasileira válida ou use /advogados sem parâmetro.');
        return true;
      }
      await sendLawyerRecommendations(chatId, String(chatId), preferredState);
      return true;
    }

    case '/registrar_advogado': {
      if (message.chat?.type !== 'private') {
        await sendMessage(chatId, 'Por segurança, o cadastro de advogado só pode ser feito em conversa privada com o bot.');
        return true;
      }
      const existing = await dbLawyers.getByTelegramId(chatId);
      if (existing) {
        await sendMessage(chatId, `ℹ️ Já existe um perfil associado à sua conta (status: ${existing.status}). Use /meu_perfil para consultá-lo.`);
        return true;
      }
      lawyerRegistration.set(String(chatId), { step: 'name', profile: {} });
      await sendMessage(chatId, '⚖️ Cadastro de advogado iniciado. Envie seu nome completo. Use /cancelar para interromper.');
      return true;
    }

    case '/cancelar':
      if (lawyerRegistration.delete(String(chatId))) {
        await sendMessage(chatId, 'Cadastro de advogado cancelado.');
      } else {
        await sendMessage(chatId, 'Não há fluxo de cadastro em andamento.');
      }
      return true;

    case '/meu_perfil': {
      const data = await dbLawyers.getDashboardData(chatId);
      if (!data) {
        await sendMessage(chatId, 'ℹ️ Nenhum perfil de advogado encontrado. Use /registrar_advogado para se cadastrar.');
        return true;
      }
      await sendMessage(chatId, `⚖️ ${data.lawyer.name}\nOAB: ${data.lawyer.oabNumber}\nEspecialidades: ${data.lawyer.specializations.map((code) => getSpecialization(code)?.name || code).join(', ')}\nLocalização: ${data.lawyer.location.city}, ${data.lawyer.location.state}\nTelefone: ${data.lawyer.phone}\nTelegram: ${data.lawyer.telegramUsername ? `@${data.lawyer.telegramUsername}` : 'não informado'}\nBio: ${data.lawyer.bio}\nStatus: ${data.lawyer.status}\nIndicações recebidas: ${data.totalReferrals}\nContatos pendentes: ${data.pendingContacts}\n\nUse /dashboard_advogado para abrir o painel.`);
      return true;
    }

    case '/editar_perfil': {
      const [field, ...valueParts] = getCommandArgs(text).split(/\s+/);
      const value = valueParts.join(' ').trim();
      const lawyer = await dbLawyers.getByTelegramId(chatId);
      if (!lawyer) {
        await sendMessage(chatId, 'ℹ️ Cadastre-se primeiro com /registrar_advogado.');
        return true;
      }
      const updates = {};
      if (field === 'bio' && value.length >= 10 && value.length <= 500) updates.bio = value;
      else if (field === 'telefone' && parsePhone(value)) updates.phone = parsePhone(value);
      else if (field === 'especialidades') {
        const specializations = parseSpecializations(value);
        if (specializations.length) updates.specializations = specializations;
      }
      else if (field === 'cidade' && value.length >= 2 && value.length <= 100) updates['location.city'] = value;
      else if (field === 'estado' && isValidBrazilianState(value)) updates['location.state'] = value.toUpperCase();
      else if (field === 'telegram') {
        const username = value === '-' ? '' : value.replace(/^@/, '');
        if (!username || /^[A-Za-z0-9_]{5,32}$/.test(username)) updates.telegramUsername = username;
      }
      if (!Object.keys(updates).length) {
        await sendMessage(chatId, 'ℹ️ Uso: /editar_perfil <bio|telefone|especialidades|cidade|estado|telegram> <novo valor>.');
        return true;
      }
      const updated = await dbLawyers.updateProfile(chatId, updates);
      await sendMessage(chatId, updated ? '✅ Perfil atualizado.' : '⚠️ Não foi possível atualizar o perfil.');
      return true;
    }

    case '/dashboard_advogado': {
      const lawyer = await dbLawyers.getByTelegramId(chatId);
      if (!lawyer) {
        await sendMessage(chatId, 'ℹ️ Cadastre-se primeiro com /registrar_advogado.');
        return true;
      }
      const token = createLawyerDashboardToken(chatId, config.telegramBotToken);
      await sendMessage(chatId, `🔐 Acesso temporário ao painel (válido por 15 minutos):\n${config.publicUrl}/admin/lawyer-dashboard?token=${encodeURIComponent(token)}`);
      return true;
    }

    case '/marcar_indicacao': {
      const [referralId, status] = getCommandArgs(text).split(/\s+/);
      const updated = status === 'convertida' && await dbReferrals.markConverted(referralId, chatId);
      await sendMessage(chatId, updated
        ? '✅ Indicação marcada como convertida.'
        : '⚠️ Não foi possível atualizar. Use /marcar_indicacao <id> convertida com o ID de uma indicação sua.');
      return true;
    }

    case '/admin': {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, '⚠️ Este comando só pode ser usado por administradores do bot.');
        return true;
      }

      if (!config.adminPanelKey) {
        await sendMessage(chatId, '⚠️ O painel administrativo ainda não está ativo. Configure ADMIN_PANEL_KEY no ambiente.');
        return true;
      }

      const adminUrl = `${config.publicUrl}/admin?key=${config.adminPanelKey}`;
      await sendMessage(chatId, `📊 Painel administrativo disponível em: ${adminUrl}\n\n⚠️ Este link contém uma chave sensível — evite compartilhá-lo. Para chamadas de API, prefira o header x-admin-key.`);
      return true;
    }

    case '/resetar': {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, '⚠️ A limpeza do histórico está disponível apenas para administradores do bot.');
        return true;
      }

      const [messagesCleared, casesCleared] = await Promise.all([
        dbChat.clearHistory(chatId),
        dbCases.deleteAllForUser(chatId),
      ]);

      const cleared = messagesCleared || casesCleared;
      await sendMessage(chatId, cleared
        ? '🧹 Histórico de mensagens e casos desta conversa foram removidos com sucesso.'
        : 'ℹ️ Nenhum dado foi encontrado para limpar.');
      return true;
    }

    case '/novo_caso': {
      const titulo = getCommandArgs(text);
      const user = await dbUsers.getUser(chatId);
      const novoCaso = await dbCases.createCase(chatId, titulo, user?.specialization);

      if (!novoCaso) {
        await sendMessage(chatId, '⚠️ Não foi possível criar o caso agora. Verifique se o banco de dados está configurado (MONGODB_URI).');
        return true;
      }

      await sendMessage(chatId, `🗂️ Novo caso criado: #${novoCaso.number} - ${novoCaso.title}${getSpecialization(novoCaso.specialization) ? `\nEspecialidade: ${getSpecialization(novoCaso.specialization).name}` : ''}\nEle já está ativo. Sua próxima conversa será registrada nele.`);
      return true;
    }

    case '/casos': {
      const casos = await dbCases.listCases(chatId);

      if (!casos.length) {
        await sendMessage(chatId, 'ℹ️ Você ainda não tem casos. Use /novo_caso para criar o primeiro.');
        return true;
      }

      const lista = casos
        .map((c) => `${c.number}. ${c.title}${getSpecialization(c.specialization) ? ` — ${getSpecialization(c.specialization).name}` : ''}${c.isActive ? ' (ativo)' : ''}`)
        .join('\n');
      await sendMessage(chatId, `🗂️ Seus casos:\n${lista}\n\nUse /caso <número> para trocar de caso.`);
      return true;
    }

    case '/caso': {
      const arg = getCommandArgs(text);
      const numero = Number.parseInt(arg, 10);

      if (!arg || Number.isNaN(numero) || numero < 1) {
        await sendMessage(chatId, 'ℹ️ Use /caso <número> informando o número do caso. Veja seus casos com /casos.');
        return true;
      }

      const caso = await dbCases.setActiveCaseByNumber(chatId, numero);
      await sendMessage(chatId, caso
        ? `✅ Caso ativo alterado para #${caso.number} - ${caso.title}${getSpecialization(caso.specialization) ? ` (${getSpecialization(caso.specialization).name})` : ''}.`
        : '⚠️ Caso não encontrado. Veja seus casos com /casos.');
      return true;
    }

    default:
      return false;
  }
}

async function processUpdate(message) {
  const chatId = String(message.chat.id);
  const incomingText = String(message.text || message.caption || '').trim();
  const command = getCommand(incomingText);

  if (isRateLimited(chatId)) {
    await sendMessage(chatId, '⏳ Você está enviando mensagens em excesso. Aguarde um momento antes de continuar.');
    return;
  }

  if (command && await handleCommand(chatId, command, incomingText, message)) {
    return;
  }

  if (lawyerRegistration.has(chatId) && await continueLawyerRegistration(chatId, incomingText, message)) return;

  let textoParaIA = incomingText;

  if (message.document) {
    if (message.document.mime_type !== 'application/pdf') {
      await sendMessage(chatId, '❌ No momento, consigo analisar apenas arquivos PDF.');
      return;
    }

    await sendMessage(chatId, '⏳ Recebi o PDF. Vou analisar o conteúdo, aguarde um momento...');
    const pdfExtraido = await withTypingIndicator(chatId, () => lerPdfDoTelegram(message.document.file_id, config.telegramBotToken));
    if (!pdfExtraido) {
      await sendMessage(chatId, '❌ Não consegui ler este PDF. Verifique se ele não está protegido, corrompido ou baseado apenas em imagens.');
      return;
    }

    textoParaIA = `O usuário enviou um documento PDF. Analise o conteúdo abaixo e responda à dúvida do usuário.\n\nCONTEÚDO DO PDF:\n${pdfExtraido}\n\nDÚVIDA DO USUÁRIO:\n${incomingText || '(análise geral do documento)'}`;
  }

  if (!textoParaIA) {
    await sendMessage(chatId, 'Envie uma dúvida, um comando ou um arquivo PDF para começar. Use /help para ajuda.');
    return;
  }

  const activeCase = await dbCases.getActiveCase(chatId);
  const reply = await withTypingIndicator(
    chatId,
    () => askGemini(chatId, textoParaIA, activeCase?.id, activeCase?.specialization)
  );

  if (reply.startsWith('[GERAR_DOC]')) {
    const lines = reply.split('\n');
    const titulo = lines[1]?.trim() || 'Documento Jurídico';
    const conteudoDoc = lines.slice(2).join('\n').trim();
    const docBuffer = await criarDocx(titulo, conteudoDoc);
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', docBuffer, { filename: `${sanitizeFileName(titulo)}.docx` });
    form.append('caption', '📄 Documento gerado. Revise o conteúdo com um advogado antes de utilizar.');
    await withRetry(() => axios.post(`${TELEGRAM_API}/sendDocument`, form, { headers: form.getHeaders(), timeout: 30000 }), { retries: 1, baseDelayMs: 500 });
    return;
  }

  await sendMessage(chatId, reply);
  if (isComplexLegalQuestion(textoParaIA)) {
    await sendLawyerRecommendations(chatId, chatId);
  }
}

async function processCallbackQuery(callback) {
  const chatId = String(callback.message?.chat?.id || '');
  const userId = String(callback.from?.id || '');
  if (!chatId || !userId || chatId !== userId || callback.message?.chat?.type !== 'private') {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callback.id }, { timeout: 8000 });
    return;
  }
  await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callback.id }, { timeout: 8000 });

  const [action, value] = String(callback.data || '').split(':');
  if (action === 'specialization') {
    const specialization = getSpecialization(value);
    if (!specialization) return;
    const saved = await dbUsers.setSpecialization(userId, specialization.code, userDisplayName(callback.from));
    await sendMessage(chatId, saved
      ? `✅ Sua especialidade agora é ${specialization.name}.`
      : '⚠️ Não foi possível salvar sua especialidade.');
    return;
  }

  if (action === 'referral_contact') {
    const referral = await dbReferrals.getForUser(value, userId);
    if (!referral || !['pending', 'contacted'].includes(referral.status) || referral.userConsent) {
      await sendMessage(chatId, 'ℹ️ Esta indicação não está mais disponível.');
      return;
    }
    const clicked = await dbReferrals.markContactClick(value, userId);
    if (!clicked) {
      await sendMessage(chatId, '⚠️ Não foi possível registrar seu clique. Tente novamente.');
      return;
    }
    await sendMessage(chatId, '✅ Você permitirá que este advogado veja seu contato?\n\nSomente ao escolher “Sim” compartilharemos seu nome e usuário do Telegram.', {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Sim, conectar', callback_data: `referral_yes:${value}` },
          { text: 'Não, obrigado', callback_data: `referral_no:${value}` },
        ]],
      },
    });
    return;
  }

  if (action === 'referral_no') {
    const rejected = await dbReferrals.reject(value, userId);
    await sendMessage(chatId, rejected ? 'Tudo bem. Seu contato não será compartilhado.' : 'ℹ️ Esta indicação não está mais disponível.');
    return;
  }

  if (action === 'referral_yes') {
    const existing = await dbReferrals.getForUser(value, userId);
    if (!existing || (existing.status !== 'contacted' && !existing.userConsent)) {
      await sendMessage(chatId, 'ℹ️ Esta indicação não está mais disponível.');
      return;
    }
    if (existing.userConsent) {
      await sendMessage(chatId, '✅ Seu contato já foi compartilhado com este advogado.');
      return;
    }
    const contact = {
      name: userDisplayName(callback.from) || 'Usuário do Telegram',
      telegramUsername: callback.from.username || null,
      telegramId: userId,
    };
    const referral = await dbReferrals.consentAndContact(value, userId, contact);
    if (!referral) {
      await sendMessage(chatId, 'ℹ️ Seu consentimento já foi registrado ou a indicação não está mais disponível.');
      return;
    }
    const lawyer = await dbLawyers.getById(referral.lawyerId);
    let lawyerNotified = false;
    if (lawyer) {
      const contactUrl = contact.telegramUsername
        ? `https://t.me/${contact.telegramUsername}`
        : `tg://user?id=${encodeURIComponent(userId)}`;
      try {
        await sendMessage(lawyer.telegramId, `📩 Um usuário aceitou compartilhar o contato após uma indicação de ${getSpecialization(referral.specialization)?.name || referral.specialization}.\nNome: ${contact.name}\nTelegram: ${contact.telegramUsername ? `@${contact.telegramUsername}` : contactUrl}\n\nRespeite o consentimento e utilize os dados somente para responder a esta solicitação.`);
        lawyerNotified = true;
      } catch (error) {
        console.error('[ERRO TELEGRAM] Falha ao notificar advogado sobre indicação:', error.message);
      }
    }
    await sendMessage(chatId, lawyerNotified
      ? '✅ Conectamos você ao advogado. Seu nome e contato do Telegram foram compartilhados.'
      : '✅ Seu consentimento foi registrado. Não foi possível avisar o advogado automaticamente; tente novamente mais tarde.');
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bot-advogado-telegram', timestamp: new Date().toISOString() });
});

app.get('/admin', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;
  const [stats, lawyers] = await Promise.all([getChatStats(), dbLawyers.listForAdmin()]);
  // Só embutimos a chave no formulário quando ela já veio pela query string
  // (necessário para o form HTML funcionar); acesso via header não expõe a
  // chave de volta na página.
  const adminKeyForForm = req.query.key ? escapeHtmlAttribute(String(req.query.key)) : '';
  res.type('html').send(renderAdminPage(stats, adminKeyForForm, lawyers));
});

app.post('/admin/lawyers/:id/status', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;
  const lawyer = await dbLawyers.setStatus(req.params.id, req.body?.status, req.ip);
  if (!lawyer) {
    res.status(400).send('Transição inválida ou advogado não encontrado.');
    return;
  }
  res.type('html').send(`<!DOCTYPE html><html lang="pt-BR"><meta charset="UTF-8"><p>Perfil de ${escapeHtmlAttribute(lawyer.name)} atualizado para ${escapeHtmlAttribute(lawyer.status)}.</p><p><a href="/admin${req.body?.key ? `?key=${encodeURIComponent(req.body.key)}` : ''}">Voltar ao painel</a></p></html>`);
});

app.get('/admin/lawyer-dashboard', async (req, res) => {
  const telegramId = verifyLawyerDashboardToken(req.query.token, config.telegramBotToken);
  if (!telegramId) {
    res.status(401).send('Link inválido ou expirado. Solicite um novo link com /dashboard_advogado no Telegram.');
    return;
  }
  const data = await dbLawyers.getDashboardData(telegramId);
  if (!data) {
    res.status(404).send('Perfil de advogado não encontrado.');
    return;
  }
  data.token = String(req.query.token);
  res.type('html').send(renderLawyerDashboard(data));
});

app.post('/admin/lawyer-dashboard/convert', async (req, res) => {
  const telegramId = verifyLawyerDashboardToken(req.body?.token, config.telegramBotToken);
  if (!telegramId) {
    res.status(401).send('Link inválido ou expirado. Solicite um novo link com /dashboard_advogado no Telegram.');
    return;
  }
  const updated = await dbReferrals.markConverted(req.body?.referralId, telegramId);
  if (!updated) {
    res.status(400).send('Indicação inválida ou já atualizada.');
    return;
  }
  const data = await dbLawyers.getDashboardData(telegramId);
  if (!data) {
    res.status(404).send('Perfil de advogado não encontrado.');
    return;
  }
  data.token = String(req.body.token);
  res.type('html').send(renderLawyerDashboard(data));
});

app.get('/admin/stats', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;
  const stats = await getChatStats();
  res.json(stats);
});

app.post('/admin/clear-history', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;

  if (req.body?.confirm !== 'CONFIRMAR') {
    res.status(400).json({
      cleared: false,
      message: 'Confirmação obrigatória. Envie o campo confirm com o valor "CONFIRMAR" para prosseguir.',
    });
    return;
  }

  const cleared = await dbChat.clearAllHistory();
  res.json({ cleared, message: cleared ? 'Histórico geral limpo com sucesso.' : 'Nada para limpar.' });
});

app.post('/webhook', (req, res) => {
  const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];

  if (!isValidWebhookSecret(receivedSecret, config.telegramWebhookSecret)) {
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  const update = req.body || {};
  const { update_id: updateId } = update;

  if (updateDeduplicator.isDuplicate(updateId)) {
    return;
  }

  if (update.callback_query) {
    processCallbackQuery(update.callback_query).catch((error) => {
      console.error('[ERRO CALLBACK]', error.message);
    });
    return;
  }

  const message = update.message || update.edited_message;
  if (!message?.chat?.id) return;

  processUpdate(message).catch(async (error) => {
    console.error('[ERRO UPDATE]', error.message);
    try {
      await sendMessage(String(message.chat.id), '⚠️ Ocorreu um erro ao processar sua solicitação. Tente novamente em instantes.');
    } catch (sendError) {
      console.error('[ERRO TELEGRAM]', sendError.message);
    }
  });
});

const server = app.listen(config.port, async () => {
  console.log(`⚖️ Servidor Jurídico ativo na porta ${config.port}`);
  await conectarBanco();
});

function shutdown(signal) {
  console.log(`Recebido ${signal}. Encerrando servidor...`);
  rateLimiter.stop();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
