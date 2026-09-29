import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { askGemini } from './gemini.js';
import { lerPdfDoTelegram } from './pdf.js';
import { criarDocx } from './word.js';
import { conectarBanco } from './database.js';
import { config, validateConfig } from './config.js';

validateConfig();

const app = express();
app.use(express.json({ limit: '1mb' }));

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;
const MAX_TELEGRAM_MESSAGE_LENGTH = 4000;

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

async function processUpdate(message) {
  const chatId = String(message.chat.id);
  const text = message.text?.trim() || '';
  const command = getCommand(text);

  if (command === '/start') {
    await sendMessage(chatId, '⚖️ Olá! Sou o assistente jurídico do bot. Envie sua dúvida, um PDF para análise ou use /help para ver os comandos.\n\nAviso: minhas respostas são informativas e não substituem um advogado.');
    return;
  }

  if (command === '/help') {
    await sendMessage(chatId, '📚 Comandos disponíveis:\n/start — iniciar o atendimento\n/help — mostrar esta ajuda\n/status — verificar se o bot está online\n/sobre — informações e aviso legal\n\nVocê também pode enviar uma dúvida ou um PDF.');
    return;
  }

  if (command === '/status') {
    await sendMessage(chatId, '✅ Bot online e pronto para atender.');
    return;
  }

  if (command === '/sobre') {
    await sendMessage(chatId, '⚖️ Bot Advogado Telegram\nAssistente jurídico com análise de texto/PDF e geração de documentos.\n\nAs respostas são educacionais e não constituem consulta ou parecer jurídico.');
    return;
  }

  let textoParaIA = text;

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

    textoParaIA = `O usuário enviou um documento PDF. Analise o conteúdo abaixo e responda à dúvida do usuário.\n\nCONTEÚDO DO PDF:\n${pdfExtraido}\n\nDÚVIDA DO USUÁRIO:\n${text || 'Faça um resumo dos pontos jurídicos mais importantes.'}`;
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
