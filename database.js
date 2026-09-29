import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const conectarBanco = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Variável MONGODB_URI ausente no Render.");
    }
    // O Mongoose gerencia automaticamente as quedas e reconexões de rede
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas conectado. Memória de longo prazo operacional.');
  } catch (error) {
    console.error('❌ Falha na ignição do MongoDB:', error);
  }
};

conectarBanco();

// Molde de blindagem: rejeita qualquer dado que fuja deste padrão
const messageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  role: { type: String, required: true, enum: ['user', 'model'] },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

export const dbChat = {
  async saveMessage(userId, role, content) {
    try {
      const novaMensagem = new Message({ userId, role, content });
      await novaMensagem.save();
    } catch (error) {
      console.error('[ERRO DB] Falha ao persistir mensagem:', error);
    }
  },

  async getHistory(userId, limit = 20) {
    try {
      const mensagensDb = await Message.find({ userId })
                                     .sort({ timestamp: -1 })
                                     .limit(limit);

      const mensagensOrdenadas = mensagensDb.reverse();

      return mensagensOrdenadas.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
    } catch (error) {
      console.error('[ERRO DB] Falha na extração de histórico:', error);
      return [];
    }
  }
};
