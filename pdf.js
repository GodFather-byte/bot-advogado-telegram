import axios from 'axios';
import pdfParse from 'pdf-parse';

export async function lerPdfDoTelegram(fileId, botToken) {
  try {
    // Pega o caminho do arquivo no servidor do Telegram
    const { data } = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const filePath = data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    
    // Baixa o arquivo em formato binário e extrai o texto
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const pdfData = await pdfParse(response.data);
    
    return pdfData.text;
  } catch (error) {
    console.error('[ERRO PDF] Falha ao ler o arquivo:', error.message);
    return null;
  }
}
