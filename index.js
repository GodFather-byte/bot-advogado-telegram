import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { Document, Packer, Paragraph, TextRun } from 'docx';
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
  const text = message.text || message.caption || "";
  let fileData = null;

  try {
    // Intercepta PDFs ou Mensagens de Voz (Áudio)
    const anexo = message.document || message.voice;

    if (anexo) {
      const isPdf = anexo.mime_type === 'application/pdf';
      const isAudio = Boolean(message.voice);

      if (isPdf || isAudio) {
        const fileId = anexo.file_id;
        const mimeType = isAudio ? 'audio/ogg' : 'application/pdf';
        const logTipo = isAudio ? 'ÁUDIO' : 'PDF';

        console.log(`[DOWNLOAD] Baixando ${logTipo} de ${chatId}...`);
        
        const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
        const filePath = fileRes.data.result.file_path;
        
        const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
        const downloadRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        
        fileData = {
          base64: Buffer.from(downloadRes.data).toString('base64'),
          mimeType: mimeType
        };
        console.log(`[DOWNLOAD] ${logTipo} pronto para análise!`);
      } else {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Doutor(a), no momento analiso apenas arquivos em formato PDF ou Mensagens de Voz."
        });
        return;
      }
    }

    if (!text && !fileData) return;

    console.log(`[ANALISANDO] Chat: ${chatId}`);
    const reply = await askGemini(chatId, text, fileData);

    // 1. ENTREGA O TEXTO LIMPO NO CHAT (Resolvido o bug de formatação)
    const chunks = reply.match(/[\s\S]{1,4000}/g) || [];
    let cleanReply = "";
    
    for (const chunk of chunks) {
      const cleanText = chunk.replace(/\*\*/g, '').replace(/\*/g, '');
      cleanReply += cleanText + "\n";
      
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: cleanText
      });
    }

    // 2. GERA E ENTREGA O ARQUIVO .DOCX
    console.log(`[GERANDO DOCX] Criando arquivo Word para ${chatId}...`);
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: cleanReply.split('\n').map(line => new Paragraph({
          children: [new TextRun({ text: line, size: 24 })] // size 24 equivale a fonte tamanho 12
        }))
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', buffer, { filename: 'Parecer_Juridico.docx' });

    await axios.post(`${TELEGRAM_API}/sendDocument`, form, {
      headers: form.getHeaders()
    });
    console.log(`[SUCESSO] Arquivo Word enviado!`);

  } catch (error) {
    console.error('[ERRO SISTEMA]', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚖️ Servidor Jurídico rodando na porta ${PORT}`);
});
