import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';
import { config } from './config.js';

const systemInstruction = `Você é um assistente virtual jurídico de primeira linha, em português do Brasil.
Forneça informações educativas, explique conceitos com clareza e recomende a consulta a um advogado habilitado para decisões concretas. Não prometa resultados e não substitua aconselhamento jurídico profissional.
Se o cliente enviar um PDF, analise o conteúdo com precisão e destaque limitações ou trechos ilegíveis.

REGRA PARA GERAR DOCUMENTOS:
Quando o usuário pedir uma procuração, contrato, petição ou outro documento, sua resposta DEVE começar exatamente com [GERAR_DOC]. Na linha seguinte, escreva o título e, depois, o conteúdo completo do documento.`;

export async function askGemini(userId, userMessage) {
  if (!config.geminiApiKey) {
    return '⚠️ O serviço de inteligência artificial ainda não foi configurado. Fale com o administrador do bot.';
  }

  const history = await dbChat.getHistory(userId);
  await dbChat.saveMessage(userId, 'user', userMessage);

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel,
      systemInstruction,
      generationConfig: { temperature: 0.5 },
    });

    const contents = [...history, { role: 'user', parts: [{ text: userMessage }] }];
    const response = await model.generateContent({ contents });
    const replyText = response.response.text()?.trim();

    if (!replyText) throw new Error('A IA retornou uma resposta vazia.');

    await dbChat.saveMessage(userId, 'model', replyText);
    return replyText;
  } catch (error) {
    console.error('[ERRO GEMINI]', error.message);
    return 'Meus servidores estão passando por instabilidade momentânea. Poderia repetir em instantes?';
  }
}
