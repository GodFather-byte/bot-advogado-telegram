import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { askGemini } from './gemini.js';

dotenv.config();

if (!process.env.GEMINI_API_KEY || !process.env.TELEGRAM_BOT_TOKEN || !process.env.MONGODB_URI) {
  console.error('⚠️ Variáveis de ambiente incompletas. Verifique o painel do Render.');
  process.exit(1);
}

const app = express();
app.use(express.json());

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} interceptado em ${req.url}`);
  next();
});

app.post('/webhook', async (req, res) => {
  // Responde ao Telegram instantaneamente para ele não tentar reenviar a mesma mensagem
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = String(message.chat.id);
  const text = message.text;

  console.log(`[TRIAGEM] Processando caso do Chat: ${chatId}`);

  // Aciona a Inteligência Artificial e busca o histórico no MongoDB
  const reply = await askGemini(chatId, text);

  try {
    // Envia a resposta final para o cliente no Telegram em modo texto puro
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: reply 
    });
  } catch (error) {
    console.error('[ERRO TELEGRAM]', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚖️ Servidor Jurídico ativo na porta ${PORT}`);
});
