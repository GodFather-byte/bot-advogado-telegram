import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbChat } from './database.js';

export async function askGemini(userId, userMessage, fileData = null) {
  // 1. Busca o histórico de conversas anteriores do advogado
  const history = dbChat.getHistory(userId);
  
  // 2. Salva a nova mensagem. Se houver arquivo, adiciona um marcador visual no banco de dados
  const dbLogText = fileData ? `[Arquivo PDF anexado] ${userMessage}` : userMessage;
  dbChat.saveMessage(userId, 'user', dbLogText);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 3. Inicializa o modelo Lite para alta disponibilidade e custo zero
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite', 
      systemInstruction: `Você é um Consultor Jurídico Sênior especialista no Sistema Jurídico Brasileiro.
Seu objetivo é auxiliar advogados na análise de contratos, peças processuais e PDFs em anexo.
- Use linguagem culta, formal e técnica (juridiquês).
- Ao analisar um PDF, procure ativamente por brechas, cláusulas abusivas ou contradições.
- Baseie-se no Código Civil, CLT, Código Penal e Constituição Federal.
- Estruture suas análises com tópicos claros para facilitar a leitura.`,
      generationConfig: { temperature: 0.3 } // Mantém a resposta técnica, previsível e focada
    });

    // 4. Monta o payload do turno atual. Se houver um PDF em Base64, ele é injetado aqui.
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

    // 5. Junta o histórico (passado) com a requisição multímodal (presente)
    const contents = [
      ...history,
      { role: 'user', parts: currentParts }
    ];

    const response = await model.generateContent({ contents });
    const replyText = response.response.text();

    // 6. Salva o parecer jurídico na memória do bot
    dbChat.saveMessage(userId, 'model', replyText);
    return replyText;
    
  } catch (error) {
    console.error('[ERRO GEMINI]', error);
    return 'Doutor(a), houve uma falha ao processar a documentação. Por favor, tente enviar o arquivo novamente em alguns instantes.';
  }
}
