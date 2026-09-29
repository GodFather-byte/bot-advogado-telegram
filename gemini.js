import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';

export async function askGemini(userId, userMessage, fileData = null) {
  const history = dbChat.getHistory(userId);
  
  // Registra no banco se houve anexo para dar contexto histórico à IA
  const dbLogText = fileData ? `[Arquivo anexado: ${fileData.mimeType}] ${userMessage}` : userMessage;
  dbChat.saveMessage(userId, 'user', dbLogText);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `Você é um Consultor Jurídico Sênior especialista no Sistema Jurídico Brasileiro.
Seu objetivo é auxiliar advogados na análise de contratos, redação de peças processuais e pareceres técnicos a partir de texto, PDFs ou Áudios.
- Ao receber ÁUDIO: atue ouvindo o relato de um colega. Extraia os fatos narrados na voz, identifique o direito e redija a peça ou parecer cabível.
- Ao receber PDF: identifique ativamente cláusulas leoninas, nulidades, obscuridades e desequilíbrios contratuais.
- Embasamento: justifique teses com base na legislação brasileira vigente (Código Civil, CDC, CLT, CPC) e jurisprudência pacificada (STJ/STF).
- Mantenha rigor técnico, linguagem formal (juridiquês) e estrutura visual em tópicos claros.`,
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
  
  const textoFinal = userMessage.trim() !== "" ? userMessage : "Transcreva e elabore o parecer técnico/peça jurídica deste anexo.";
  currentParts.push({ text: textoFinal });

  const contents = [
    ...history,
    { role: 'user', parts: currentParts }
  ];

  // Algoritmo de Retry: absorve picos temporários de 503 Service Unavailable do Google
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await model.generateContent({ contents });
      const replyText = response.response.text();

      dbChat.saveMessage(userId, 'model', replyText);
      return { success: true, text: replyText };

    } catch (error) {
      console.error(`[ALERTA GEMINI - TENTATIVA ${attempt}]`, error.message);
      if (attempt === 1) {
        // Aguarda 2.5 segundos para a fila do Google aliviar
        await new Promise(resolve => setTimeout(resolve, 2500));
      } else {
        return { 
          success: false, 
          text: 'Doutor(a), os servidores de inteligência jurídica estão com alta demanda momentânea (Código 503). Por favor, reenvie a solicitação em 30 segundos.' 
        };
      }
    }
  }
}
