import axios from 'axios';
import pdfParse from 'pdf-parse';
import { config } from './config.js';

export async function lerPdfDoTelegram(fileId, botToken) {
  try {
    const { data } = await axios.get(`https://api.telegram.org/bot${botToken}/getFile`, {
      params: { file_id: fileId },
      timeout: 15000,
    });

    if (!data.ok || !data.result?.file_path) throw new Error('Telegram não retornou o caminho do arquivo.');

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
    });
    const pdfData = await pdfParse(response.data);

    return pdfData.text?.trim().slice(0, config.maxPdfCharacters) || null;
  } catch (error) {
    console.error('[ERRO PDF] Falha ao ler o arquivo:', error.message);
    return null;
  }
}
