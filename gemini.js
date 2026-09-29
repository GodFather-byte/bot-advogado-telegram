import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';
import dotenv from 'dotenv';
dotenv.config();

const systemInstruction = `Você é um assistente virtual jurídico de primeira linha.
Se o cliente enviar um PDF, analise o conteúdo juridicamente com precisão.

⚠️ REGRA CRÍTICA PARA GERAR DOCUMENTOS:
Se o usuário pedir para gerar uma procuração, contrato, petição ou documento, você DEVE retornar a sua resposta começando EXATAMENTE com a tag: [GERAR_DOC]
Na linha seguinte, escreva o Título do documento.
Nas linhas seguintes, redija o documento completo e bem formatado.

Exemplo do formato exigido:
[GERAR_DOC]
Procuração Ad Judicia
Pelo presente instrumento particular de procuração...`;

export async function askGemini(userId, userMessage) {
  const history = await dbChat.getHistory(userId);
  await dbChat.saveMessage(userId, 'user', userMessage);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      systemInstruction: systemInstruction,
      generationConfig: { temperature: 0.5 }
    });

    const contents = [...history, { role: 'user', parts: [{ text: userMessage }] }];
    const response = await model.generateContent({ contents });
    const replyText = response.response.text();

    await dbChat.saveMessage(userId, 'model', replyText);
    return replyText;
    
  } catch (error) {
    console.error('[ERRO GEMINI]', error);
    return 'Meus servidores estão passando por instabilidade momentânea. Poderia repetir em instantes?';
  }
}
