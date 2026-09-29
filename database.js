import mongoose from 'mongoose';
import { config } from './config.js';

const messageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, required: true, enum: ['user', 'model'] },
    content: { type: String, required: true, maxlength: 100000 },
  },
  { timestamps: true }
);

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

let connectionPromise;

export async function conectarBanco() {
  if (!config.mongodbUri) {
    console.warn('⚠️ MONGODB_URI não configurada. O histórico ficará indisponível.');
    return false;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    await connectionPromise;
    console.log('✅ MongoDB Atlas conectado.');
    return true;
  } catch (error) {
    connectionPromise = undefined;
    console.error('❌ Falha ao conectar ao MongoDB:', error.message);
    return false;
  }
}

export async function getChatStats() {
  if (mongoose.connection.readyState !== 1) {
    return {
      totalMessages: 0,
      uniqueUsers: 0,
      lastUserMessageAt: null,
      available: false,
    };
  }

  try {
    const [totalMessages, uniqueUsers, lastUserMessage] = await Promise.all([
      Message.countDocuments(),
      Message.distinct('userId').then((ids) => ids.length),
      Message.findOne({ role: 'user' }).sort({ createdAt: -1 }).lean(),
    ]);

    return {
      totalMessages,
      uniqueUsers,
      lastUserMessageAt: lastUserMessage?.createdAt || null,
      available: true,
    };
  } catch (error) {
    console.error('[ERRO DB] Falha ao buscar estatísticas:', error.message);
    return {
      totalMessages: 0,
      uniqueUsers: 0,
      lastUserMessageAt: null,
      available: false,
    };
  }
}

export const dbChat = {
  async saveMessage(userId, role, content) {
    if (mongoose.connection.readyState !== 1 || !content?.trim()) return;

    try {
      await Message.create({ userId: String(userId), role, content: content.trim() });
    } catch (error) {
      console.error('[ERRO DB] Falha ao persistir mensagem:', error.message);
    }
  },

  async getHistory(userId, limit = config.historyLimit) {
    if (mongoose.connection.readyState !== 1) return [];

    try {
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
      const messages = await Message.find({ userId: String(userId) })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();

      return messages.reverse().map(({ role, content }) => ({
        role,
        parts: [{ text: content }],
      }));
    } catch (error) {
      console.error('[ERRO DB] Falha ao extrair histórico:', error.message);
      return [];
    }
  },

  async clearHistory(userId) {
    if (mongoose.connection.readyState !== 1) return false;

    try {
      const result = await Message.deleteMany({ userId: String(userId) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('[ERRO DB] Falha ao limpar histórico:', error.message);
      return false;
    }
  },

  async clearAllHistory() {
    if (mongoose.connection.readyState !== 1) return false;

    try {
      const result = await Message.deleteMany({});
      return result.deletedCount > 0;
    } catch (error) {
      console.error('[ERRO DB] Falha ao limpar o histórico geral:', error.message);
      return false;
    }
  },
};
