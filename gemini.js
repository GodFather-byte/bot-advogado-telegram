import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';
import dotenv from 'dotenv';
dotenv.config();

const systemInstruction = `Você é um assistente virtual jurídico de primeira linha, projetado para triagem de clientes de um escritório de advocacia.
Seu tom deve ser altamente profissional, formal, empático e de extrema confiança.
Forneça respostas completas e detalhadas, traduzindo o "juridiquês" para uma linguagem clara.
Nunca prometa ganho de causa. Seu objetivo é entender o problema, explicar os direitos básicos envolvidos e preparar o agendamento com um advogado humano.`;

export async function askGemini(userId, userMessage) {
  // Busca o histórico salvo no MongoDB
  const history = await dbChat.getHistory(userId);
  
  // Salva a nova mensagem do usuário no banco
  await dbChat.saveMessage(userId, 'user', userMessage);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Motor atualizado para a versão Gemini 3.5 Flash Lite
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      systemInstruction: systemInstruction,
      generationConfig: { temperature: 0.5 } // Mantém a precisão jurídica
    });

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await model.generateContent({ contents });
    const replyText = response.response.text();

    // Salva a resposta gerada no MongoDB para consolidar a memória
    await dbChat.saveMessage(userId, 'model', replyText);
    return replyText;
    
  } catch (error) {
    console.error('[ERRO GEMINI]', error);
    return 'Compreendo a complexidade da sua solicitação, mas meus servidores estão passando por uma instabilidade momentânea. Poderia repetir sua mensagem em instantes?';
  }
}
