import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';

export async function askGemini(userId, userMessage) {
  const history = dbChat.getHistory(userId);
  dbChat.saveMessage(userId, 'user', userMessage);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `Você é um Consultor Jurídico Sênior especialista no Sistema Jurídico Brasileiro.
Seu objetivo é auxiliar advogados na análise de contratos, redação de peças processuais (petições, recursos, defesas) e interpretação de jurisprudência.
- Use linguagem culta, formal e técnica (juridiquês).
- Quando analisar um texto, procure ativamente por brechas, cláusulas abusivas ou contradições.
- Baseie-se no Código Civil, CLT, Código Penal e Constituição Federal.
- Sempre estruture suas análises com tópicos claros para facilitar a leitura.
Seja exaustivo e profundo nas suas respostas. Sempre justifique suas conclusões com princípios do direito.`,
      generationConfig: { temperature: 0.3 } // Temperatura baixa (0.3) deixa o bot mais técnico, exato e menos inventivo
    });

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await model.generateContent({ contents });
    const replyText = response.response.text();

    dbChat.saveMessage(userId, 'model', replyText);
    return replyText;
    
  } catch (error) {
    console.error('[ERRO GEMINI]', error);
    return 'Doutor(a), houve uma falha temporária de comunicação com os servidores judiciais. Por favor, reenvie a sua solicitação em alguns instantes.';
  }
}
