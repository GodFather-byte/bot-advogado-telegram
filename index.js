import express from 'express';
import axios from 'axios';
import { askGemini } from './gemini.js';

if (!process.env.GEMINI_API_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
  console.error('⚠️ Faltam variáveis de ambiente (GEMINI_API_KEY ou TELEGRAM_BOT_TOKEN)');
  process.exit(1);
}

const app = express();
app.use(express.json());

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = String(message.chat.id);
  const text = message.text;

  const reply = await askGemini(chatId, text);

  try {
    // O Telegram tem limite de 4096 caracteres. Como advogados gostam de textos longos, 
    // precisamos garantir que não dê erro se a IA escrever uma resposta muito grande.
    const chunks = reply.match(/[\s\S]{1,4000}/g) || [];
    
    for (const chunk of chunks) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    console.error('[ERRO ENVIO TELEGRAM]', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚖️ Servidor Jurídico rodando na porta ${PORT}`);
});
