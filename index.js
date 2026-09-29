import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { askGemini } from './gemini.js';
import { lerPdfDoTelegram } from './pdf.js';
import { criarDocx } from './word.js';
import { conectarBanco, dbChat, getChatStats } from './database.js';
import { config, validateConfig } from './config.js';

validateConfig();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;
const rateLimitByUser = new Map();

function renderAdminPage(stats) {
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
          <h2>🧹 Ações</h2>
          <form method="POST" action="/admin/clear-history">
            <button type="submit">Limpar todo o histórico de conversas</button>
          </form>
        </div>
      </div>
    </body>
  </html>`;
}

function ensureAdminPanelAccess(req, res) {
  if (!config.adminPanelKey) {
    res.status(503).send('Painel administrativo desabilitado. Defina ADMIN_PANEL_KEY no ambiente.');
    return false;
  }

  const providedKey = req.query.key || req.headers['x-admin-key'] || '';
  if (providedKey !== config.adminPanelKey) {
    res.status(401).send('Acesso negado. Informe a chave correta no parâmetro ?key=...');
    return false;
  }

  return true;
}

async function sendMessage(chatId, text, options = {}) {
  const chunks = String(text || 'Não foi possível gerar uma resposta.').match(/[\s\S]{1,4000}/g) || [];
  for (const chunk of chunks) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: chunk,
      ...options,
    }, { timeout: 15000 });
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

function isRateLimited(chatId) {
  const now = Date.now();
  const entries = rateLimitByUser.get(String(chatId)) || [];
  const filtered = entries.filter((timestamp) => now - timestamp < config.rateLimitWindowMs);

  if (filtered.length >= config.rateLimitPerMinute) {
    return true;
  }

  filtered.push(now);
  rateLimitByUser.set(String(chatId), filtered);
  return false;
}

function isAdmin(chatId) {
  return config.adminUserIds.includes(String(chatId));
}

async function handleCommand(chatId, command, text) {
  switch (command) {
    case '/start':
      await sendMessage(chatId, `⚖️ Olá! Sou o ${config.botName}. Envie sua dúvida, um PDF para análise ou use /help para ver os comandos.\n\nAviso: as respostas são informativas e não substituem orientação de um advogado.`);
      return true;

    case '/help':
      await sendMessage(chatId, '📚 Comandos disponíveis:\n/start — iniciar o atendimento\n/help — mostrar esta ajuda\n/status — verificar se o bot está online\n/sobre — informações do bot\n/documentos — tipos de documentos que posso ajudar\n/resetar — limpar seu histórico (admin)\n/admin — acessar painel (admin)');
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
      await sendMessage(chatId, `📊 Painel administrativo disponível em: ${adminUrl}`);
      return true;
    }

    case '/resetar': {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, '⚠️ A limpeza do histórico está disponível apenas para administradores do bot.');
        return true;
      }

      const cleared = await dbChat.clearHistory(chatId);
      await sendMessage(chatId, cleared
        ? '🧹 Histórico desta conversa foi removido com sucesso.'
        : 'ℹ️ Nenhum histórico foi encontrado para limpar.');
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

  if (command && await handleCommand(chatId, command, incomingText)) {
    return;
  }

  let textoParaIA = incomingText;

  if (message.document) {
    if (message.document.mime_type !== 'application/pdf') {
      await sendMessage(chatId, '❌ No momento, consigo analisar apenas arquivos PDF.');
      return;
    }

    await sendMessage(chatId, '⏳ Recebi o PDF. Vou analisar o conteúdo, aguarde um momento...');
    const pdfExtraido = await lerPdfDoTelegram(message.document.file_id, config.telegramBotToken);
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

  const reply = await askGemini(chatId, textoParaIA);

  if (reply.startsWith('[GERAR_DOC]')) {
    const lines = reply.split('\n');
    const titulo = lines[1]?.trim() || 'Documento Jurídico';
    const conteudoDoc = lines.slice(2).join('\n').trim();
    const docBuffer = await criarDocx(titulo, conteudoDoc);
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', docBuffer, { filename: `${sanitizeFileName(titulo)}.docx` });
    form.append('caption', '📄 Documento gerado. Revise o conteúdo com um advogado antes de utilizar.');
    await axios.post(`${TELEGRAM_API}/sendDocument`, form, { headers: form.getHeaders(), timeout: 30000 });
    return;
  }

  await sendMessage(chatId, reply);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bot-advogado-telegram', timestamp: new Date().toISOString() });
});

app.get('/admin', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;
  const stats = await getChatStats();
  res.type('html').send(renderAdminPage(stats));
});

app.get('/admin/stats', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;
  const stats = await getChatStats();
  res.json(stats);
});

app.post('/admin/clear-history', async (req, res) => {
  if (!ensureAdminPanelAccess(req, res)) return;

  const cleared = await dbChat.clearAllHistory();
  res.json({ cleared, message: cleared ? 'Histórico geral limpo com sucesso.' : 'Nada para limpar.' });
});

app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  const message = req.body?.message;
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
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
