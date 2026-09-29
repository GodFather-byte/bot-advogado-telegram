import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data'; // Biblioteca para enviar arquivos via API
import { askGemini } from './gemini.js';
import { lerPdfDoTelegram } from './pdf.js';
import { criarDocx } from './word.js';

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  let textoParaIA = message.text || '';

  // 1. O CLIENTE ENVIOU UM PDF?
  if (message.document && message.document.mime_type === 'application/pdf') {
    const fileId = message.document.file_id;
    console.log(`[TRIAGEM] Lendo PDF do Chat: ${chatId}`);
    
    const pdfExtraido = await lerPdfDoTelegram(fileId, process.env.TELEGRAM_BOT_TOKEN);
    
    if (pdfExtraido) {
      textoParaIA = `O usuário enviou um documento PDF com o seguinte conteúdo:\n\n${pdfExtraido}\n\nPor favor, responda à dúvida ou analise este documento. A dúvida do usuário foi: ${message.caption || 'Analise este documento.'}`;
    } else {
      return axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "❌ Desculpe, não consegui ler este PDF." });
    }
  }

  // Se não tem texto nem PDF, ignoramos
  if (!textoParaIA) return;

  console.log(`[TRIAGEM] Processando caso do Chat: ${chatId}`);
  const reply = await askGemini(chatId, textoParaIA);

  // 2. A IA MANDOU GERAR UM DOCUMENTO DOCX?
  if (reply.includes('[GERAR_DOC]')) {
    try {
      const linhas = reply.split('\n');
      const titulo = linhas[1] || 'Documento_Juridico';
      // Junta o resto do texto tirando a tag e o título
      const conteudoDoc = linhas.slice(2).join('\n').trim();

      const docBuffer = await criarDocx(titulo, conteudoDoc);

      // Monta o "pacote" do arquivo para enviar ao Telegram
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', docBuffer, { filename: `${titulo.replace(/ /g, '_')}.docx` });
      form.append('caption', '📄 Aqui está o documento redigido pela Inteligência Artificial.');

      await axios.post(`${TELEGRAM_API}/sendDocument`, form, { headers: form.getHeaders() });
    } catch (err) {
      console.error('[ERRO DOCX]', err);
      axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: "Ocorreu um erro ao gerar seu arquivo .docx." });
    }
  } 
  // 3. SE FOR APENAS CONVERSA NORMAL
  else {
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: reply });
    } catch (error) {
      console.error('[ERRO TELEGRAM]', error.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚖️ Servidor Jurídico ativo na porta ${PORT}`);
});
