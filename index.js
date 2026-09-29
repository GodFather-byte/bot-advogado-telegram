import express from 'express';
import axios from 'axios';
import { askGemini } from './gemini.js';

if (!process.env.GEMINI_API_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
  console.error('⚠️ Faltam variáveis de ambiente!');
  process.exit(1);
}

const app = express();
app.use(express.json());

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  
  // O usuário pode enviar apenas texto, ou um PDF com uma legenda (caption)
  const text = message.text || message.caption || "Analise este documento jurídico.";
  let fileData = null;

  try {
    // 1. VERIFICA SE HÁ UM DOCUMENTO PDF NA MENSAGEM
    if (message.document) {
      const doc = message.document;
      
      if (doc.mime_type === 'application/pdf') {
        console.log(`[DOWNLOAD] Baixando PDF de ${chatId}...`);
        
        // Passo A: Pegar o caminho do arquivo nos servidores do Telegram
        const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${doc.file_id}`);
        const filePath = fileRes.data.result.file_path;
        
        // Passo B: Fazer o download do arquivo binário e converter para Base64
        const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
        const downloadRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        
        fileData = {
          base64: Buffer.from(downloadRes.data).toString('base64'),
          mimeType: 'application/pdf'
        };
        console.log('[DOWNLOAD] PDF pronto para análise!');
      } else {
        // Se for uma imagem ou planilha, avisamos que o foco é PDF
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Doutor(a), no momento estou configurado para ler apenas arquivos em formato PDF."
        });
        return;
      }
    }

    // Se não tiver texto nem arquivo, ignora
    if (!text && !fileData) return;

    // 2. ENVIA PARA A IA (com ou sem arquivo)
    console.log(`[ANALISANDO] Chat: ${chatId} | Prompt: "${text}"`);
    const reply = await askGemini(chatId, text, fileData);

    // 3. DEVOLVE A RESPOSTA (quebrando em blocos se for muito longa)
    const chunks = reply.match(/[\s\S]{1,4000}/g) || [];
    for (const chunk of chunks) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown'
      });
    }

  } catch (error) {
    console.error('[ERRO SISTEMA]', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚖️ Servidor Jurídico rodando na porta ${PORT}`);
});
