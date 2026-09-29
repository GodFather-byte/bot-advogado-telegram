import mongoose from 'mongoose';
import { config } from './config.js';

const messageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', index: true },
    role: { type: String, required: true, enum: ['user', 'model'] },
    content: { type: String, required: true, maxlength: 100000 },
  },
  { timestamps: true }
);

const caseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: true }
);

const userCaseStateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    activeCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  },
  { timestamps: true }
);

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Case = mongoose.models.Case || mongoose.model('Case', caseSchema);
const UserCaseState = mongoose.models.UserCaseState || mongoose.model('UserCaseState', userCaseStateSchema);

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
  async saveMessage(userId, role, content, caseId) {
    if (mongoose.connection.readyState !== 1 || !content?.trim()) return;

    try {
      await Message.create({
        userId: String(userId),
        ...(caseId ? { caseId } : {}),
        role,
        content: content.trim(),
      });
    } catch (error) {
      console.error('[ERRO DB] Falha ao persistir mensagem:', error.message);
    }
  },

  async getHistory(userId, caseId, limit = config.historyLimit) {
    if (mongoose.connection.readyState !== 1) return [];

    try {
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
      const query = { userId: String(userId), ...(caseId ? { caseId } : {}) };
      const messages = await Message.find(query)
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

export const dbCases = {
  async listCases(userId) {
    if (mongoose.connection.readyState !== 1) return [];

    try {
      const state = await UserCaseState.findOne({ userId: String(userId) }).lean();
      const activeCaseId = state?.activeCaseId ? String(state.activeCaseId) : null;
      const cases = await Case.find({ userId: String(userId) }).sort({ createdAt: 1 }).lean();

      return cases.map((caseDoc, index) => ({
        number: index + 1,
        id: String(caseDoc._id),
        title: caseDoc.title,
        createdAt: caseDoc.createdAt,
        isActive: activeCaseId === String(caseDoc._id),
      }));
    } catch (error) {
      console.error('[ERRO DB] Falha ao listar casos:', error.message);
      return [];
    }
  },

  async createCase(userId, title) {
    if (mongoose.connection.readyState !== 1) return null;

    try {
      const existingCount = await Case.countDocuments({ userId: String(userId) });
      const caseTitle = String(title || '').trim() || `Caso ${existingCount + 1}`;
      const newCase = await Case.create({ userId: String(userId), title: caseTitle });

      await UserCaseState.findOneAndUpdate(
        { userId: String(userId) },
        { userId: String(userId), activeCaseId: newCase._id },
        { upsert: true }
      );

      return {
        number: existingCount + 1,
        id: String(newCase._id),
        title: newCase.title,
        createdAt: newCase.createdAt,
        isActive: true,
      };
    } catch (error) {
      console.error('[ERRO DB] Falha ao criar caso:', error.message);
      return null;
    }
  },

  async getActiveCase(userId) {
    if (mongoose.connection.readyState !== 1) return null;

    try {
      const state = await UserCaseState.findOne({ userId: String(userId) }).lean();

      if (state?.activeCaseId) {
        const activeCase = await Case.findById(state.activeCaseId).lean();
        if (activeCase) {
          return { id: String(activeCase._id), title: activeCase.title };
        }
      }

      const oldestCase = await Case.findOne({ userId: String(userId) }).sort({ createdAt: 1 }).lean();
      if (oldestCase) {
        await UserCaseState.findOneAndUpdate(
          { userId: String(userId) },
          { userId: String(userId), activeCaseId: oldestCase._id },
          { upsert: true }
        );
        return { id: String(oldestCase._id), title: oldestCase.title };
      }

      return null;
    } catch (error) {
      console.error('[ERRO DB] Falha ao obter caso ativo:', error.message);
      return null;
    }
  },

  async setActiveCaseByNumber(userId, number) {
    if (mongoose.connection.readyState !== 1) return null;

    try {
      const cases = await Case.find({ userId: String(userId) }).sort({ createdAt: 1 }).lean();
      const targetCase = cases[Number(number) - 1];
      if (!targetCase) return null;

      await UserCaseState.findOneAndUpdate(
        { userId: String(userId) },
        { userId: String(userId), activeCaseId: targetCase._id },
        { upsert: true }
      );

      return {
        number: Number(number),
        id: String(targetCase._id),
        title: targetCase.title,
        isActive: true,
      };
    } catch (error) {
      console.error('[ERRO DB] Falha ao selecionar caso:', error.message);
      return null;
    }
  },
};
