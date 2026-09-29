import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';

export async function askGemini(userId, userMessage, fileData = null) {
  const history = dbChat.getHistory(userId);
  
  // O banco de dados agora registra se a IA recebeu um PDF ou um Áudio
  const dbLogText = fileData ? `[Arquivo anexado: ${fileData.mimeType}] ${userMessage}` : userMessage;
  dbChat.saveMessage(userId, 'user', dbLogText);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite', 
      systemInstruction: `Você é um Consultor Jurídico Sênior especialista no Sistema Jurídico Brasileiro.
Seu objetivo é auxiliar advogados na análise de contratos e redação de peças processuais a partir de PDFs ou Áudios.
- Ao receber um ÁUDIO: atue como um advogado brilhante ouvindo o relato de um colega. Extraia os fatos narrados na voz, identifique o direito e redija a peça solicitada.
- Ao receber um PDF: analise ativamente em busca de brechas ou cláusulas abusivas.
- Mantenha a linguagem estritamente formal, técnica (juridiquês) e justifique suas teses com o Código Civil, CLT, Código Penal ou jurisprudência.`,
      generationConfig: { temperature: 0.3 }
    });

    const currentParts = [];
    if (fileData) {
      currentParts.push({
        inlineData: {
          data: fileData.base64,
          mimeType: fileData.mimeType
        }
      });
    }
    
    // Se o usuário mandou apenas um áudio sem texto, injetamos uma instrução base
    const textoFinal = userMessage.trim() !== "" ? userMessage : "Transcreva os fatos deste áudio e redija a peça correspondente.";
    currentParts.push({ text: textoFinal });

    const contents = [
      ...history,
      { role: 'user', parts: currentParts }
    ];

    const response = await model.generateContent({ contents });
    const replyText = response.response.text();

    dbChat.saveMessage(userId, 'model', replyText);
    return replyText;
    
  } catch (error) {
    console.error('[ERRO GEMINI]', error);
    return 'Doutor(a), houve uma falha ao processar os dados. Por favor, tente enviar o arquivo ou áudio novamente.';
  }
}
