import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';

export async function askGemini(userId, userMessage, fileData = null) {
  // Puxa o histórico
  const history = dbChat.getHistory(userId);
  
  // Salva no histórico. Se houver arquivo, coloca um marcador para a IA lembrar
  const dbLogText = fileData ? `[Arquivo PDF anexado] ${userMessage}` : userMessage;
  dbChat.saveMessage(userId, 'user', dbLogText);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `Você é um Consultor Jurídico Sênior especialista no Sistema Jurídico Brasileiro.
Seu objetivo é auxiliar advogados na análise de contratos, peças processuais e PDFs em anexo.
- Use linguagem culta, formal e técnica (juridiquês).
- Ao analisar um PDF, procure ativamente por brechas, cláusulas abusivas ou contradições.
- Baseie-se no Código Civil, CLT, Código Penal e Constituição Federal.
- Estruture suas análises com tópicos claros para facilitar a leitura.`,
      generationConfig: { temperature: 0.3 }
    });

    // Constrói a mensagem atual. Se tiver arquivo, coloca o PDF e o texto juntos.
    const currentParts = [];
    if (fileData) {
      currentParts.push({
        inlineData: {
          data: fileData.base64,
          mimeType: fileData.mimeType
        }
      });
    }
    currentParts.push({ text: userMessage });

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
    return 'Doutor(a), houve uma falha ao processar a documentação. Por favor, tente enviar o arquivo novamente.';
  }
}
