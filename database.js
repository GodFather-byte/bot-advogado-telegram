import mongoose from 'mongoose';
import { config } from './config.js';
import { SPECIALIZATIONS } from './lib/specializations.js';

const messageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    role: { type: String, required: true, enum: ['user', 'model'] },
    content: { type: String, required: true, maxlength: 100000 },
  },
  { timestamps: true }
);

// Índices compostos cobrem as consultas de histórico (por usuário e,
// opcionalmente, por caso) sem precisar de índices simples redundantes
// no mesmo prefixo, reduzindo o custo de escrita.
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, caseId: 1, createdAt: -1 });

const caseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    specialization: { type: String, default: null },
  },
  { timestamps: true }
);

caseSchema.index({ userId: 1, createdAt: 1 });

const userCaseStateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    activeCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    specialization: { type: String, default: null },
    status: { type: String, enum: ['user', 'lawyer'], default: 'user' },
    location: {
      state: { type: String, default: null },
      city: { type: String, default: null },
    },
  },
  { timestamps: true }
);

const lawyerSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 120 },
    oabNumber: { type: String, required: true, unique: true },
    oabState: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    specializations: { type: [String], required: true },
    location: {
      state: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
      city: { type: String, required: true, maxlength: 100 },
    },
    phone: { type: String, required: true, maxlength: 20 },
    bio: { type: String, required: true, maxlength: 500 },
    telegramUsername: { type: String, default: '', maxlength: 64 },
    status: {
      type: String,
      enum: ['pending_verification', 'verified', 'active', 'suspended'],
      default: 'pending_verification',
    },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: null },
  },
  { timestamps: true }
);

const referralSchema = new mongoose.Schema(
  {
    lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
    userId: { type: String, required: true },
    specialization: { type: String, required: true },
    status: { type: String, enum: ['pending', 'contacted', 'converted', 'rejected'], default: 'pending' },
    userConsent: { type: Boolean, default: false },
    contact: {
      name: { type: String, default: null },
      telegramUsername: { type: String, default: null },
      telegramId: { type: String, default: null },
    },
    contactedAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const specializationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    prompt: { type: String, required: true },
    statutes: { type: [String], default: [] },
    jurisprudencePrompt: { type: String, required: true },
    keywords: { type: [String], default: [] },
    icon: { type: String, default: '' },
  },
  { timestamps: true }
);

lawyerSchema.index({ specializations: 1, status: 1, 'location.state': 1 });
referralSchema.index({ lawyerId: 1, createdAt: -1 });
referralSchema.index({ userId: 1, createdAt: -1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Case = mongoose.models.Case || mongoose.model('Case', caseSchema);
const UserCaseState = mongoose.models.UserCaseState || mongoose.model('UserCaseState', userCaseStateSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Lawyer = mongoose.models.Lawyer || mongoose.model('Lawyer', lawyerSchema);
const Referral = mongoose.models.Referral || mongoose.model('Referral', referralSchema);
const Specialization = mongoose.models.Specialization || mongoose.model('Specialization', specializationSchema);

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
    await Specialization.bulkWrite(SPECIALIZATIONS.map((specialization) => ({
      updateOne: {
        filter: { code: specialization.code },
        update: {
          $set: {
            code: specialization.code,
            name: specialization.name,
            description: specialization.description,
            prompt: specialization.prompt,
            statutes: specialization.statutes,
            jurisprudencePrompt: specialization.jurisprudencePrompt,
            keywords: specialization.keywords,
            icon: specialization.icon,
          },
        },
        upsert: true,
      },
    })));
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

  async getById(id) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return null;
    try {
      return await Lawyer.findById(id).lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao buscar advogado:', error.message);
      return null;
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
        specialization: caseDoc.specialization || null,
        createdAt: caseDoc.createdAt,
        isActive: activeCaseId === String(caseDoc._id),
      }));
    } catch (error) {
      console.error('[ERRO DB] Falha ao listar casos:', error.message);
      return [];
    }
  },

  async createCase(userId, title, specialization) {
    if (mongoose.connection.readyState !== 1) return null;

    try {
      const existingCount = await Case.countDocuments({ userId: String(userId) });
      const caseTitle = String(title || '').trim() || `Caso ${existingCount + 1}`;
      const newCase = await Case.create({
        userId: String(userId),
        title: caseTitle,
        specialization: specialization || null,
      });

      await UserCaseState.findOneAndUpdate(
        { userId: String(userId) },
        { userId: String(userId), activeCaseId: newCase._id },
        { upsert: true }
      );

      return {
        number: existingCount + 1,
        id: String(newCase._id),
        title: newCase.title,
        specialization: newCase.specialization || null,
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
          return {
            id: String(activeCase._id),
            title: activeCase.title,
            specialization: activeCase.specialization || null,
          };
        }
      }

      const oldestCase = await Case.findOne({ userId: String(userId) }).sort({ createdAt: 1 }).lean();
      if (oldestCase) {
        await UserCaseState.findOneAndUpdate(
          { userId: String(userId) },
          { userId: String(userId), activeCaseId: oldestCase._id },
          { upsert: true }
        );
        return {
          id: String(oldestCase._id),
          title: oldestCase.title,
          specialization: oldestCase.specialization || null,
        };
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
        specialization: targetCase.specialization || null,
        isActive: true,
      };
    } catch (error) {
      console.error('[ERRO DB] Falha ao selecionar caso:', error.message);
      return null;
    }
  },

  async deleteAllForUser(userId) {
    if (mongoose.connection.readyState !== 1) return false;

    try {
      const [casesResult] = await Promise.all([
        Case.deleteMany({ userId: String(userId) }),
        UserCaseState.deleteOne({ userId: String(userId) }),
      ]);

      return casesResult.deletedCount > 0;
    } catch (error) {
      console.error('[ERRO DB] Falha ao remover casos do usuário:', error.message);
      return false;
    }
  },
};

export const dbUsers = {
  async getUser(telegramId) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
      return await User.findOne({ telegramId: String(telegramId) }).lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao buscar usuário:', error.message);
      return null;
    }
  },

  async setSpecialization(telegramId, specialization, name = '') {
    if (mongoose.connection.readyState !== 1) return false;
    try {
      await User.findOneAndUpdate(
        { telegramId: String(telegramId) },
        { $set: { specialization, ...(name ? { name } : {}) }, $setOnInsert: { telegramId: String(telegramId) } },
        { upsert: true }
      );
      return true;
    } catch (error) {
      console.error('[ERRO DB] Falha ao salvar especialidade:', error.message);
      return false;
    }
  },

  async setLocation(telegramId, state, city) {
    if (mongoose.connection.readyState !== 1) return false;
    try {
      await User.findOneAndUpdate(
        { telegramId: String(telegramId) },
        {
          $set: { 'location.state': state, 'location.city': city },
          $setOnInsert: { telegramId: String(telegramId) },
        },
        { upsert: true }
      );
      return true;
    } catch (error) {
      console.error('[ERRO DB] Falha ao salvar localização:', error.message);
      return false;
    }
  },
};

export const dbLawyers = {
  async register(profile) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
      const lawyer = await Lawyer.create({
        ...profile,
        telegramId: String(profile.telegramId),
        status: 'pending_verification',
      });
      await User.findOneAndUpdate(
        { telegramId: lawyer.telegramId },
        { $set: { name: lawyer.name, status: 'lawyer' }, $setOnInsert: { telegramId: lawyer.telegramId } },
        { upsert: true }
      );
      return lawyer.toObject();
    } catch (error) {
      console.error('[ERRO DB] Falha ao registrar advogado:', error.message);
      return null;
    }
  },

  async getByTelegramId(telegramId) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
      return await Lawyer.findOne({ telegramId: String(telegramId) }).lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao buscar perfil de advogado:', error.message);
      return null;
    }
  },

  async updateProfile(telegramId, updates) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
      return await Lawyer.findOneAndUpdate(
        { telegramId: String(telegramId) },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao atualizar perfil de advogado:', error.message);
      return null;
    }
  },

  async findRecommendations(specialization, state) {
    if (mongoose.connection.readyState !== 1) return [];
    try {
      const query = { specializations: specialization, status: 'active' };
      const projection = 'name specializations location phone bio telegramUsername';
      if (!state) return await Lawyer.find(query).select(projection).sort({ createdAt: 1 }).limit(3).lean();

      const nearby = await Lawyer.find({ ...query, 'location.state': state })
        .select(projection)
        .sort({ createdAt: 1 })
        .limit(3)
        .lean();
      if (nearby.length === 3) return nearby;
      const others = await Lawyer.find({ ...query, 'location.state': { $ne: state } })
        .select(projection)
        .sort({ createdAt: 1 })
        .limit(3 - nearby.length)
        .lean();
      return [...nearby, ...others];
    } catch (error) {
      console.error('[ERRO DB] Falha ao buscar advogados:', error.message);
      return [];
    }
  },

  async listForAdmin() {
    if (mongoose.connection.readyState !== 1) return [];
    try {
      return await Lawyer.find({ status: { $in: ['pending_verification', 'verified'] } })
        .sort({ createdAt: 1 })
        .lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao listar advogados pendentes:', error.message);
      return [];
    }
  },

  async setStatus(id, status, adminId) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return null;
    const transitions = {
      verified: { status: 'pending_verification' },
      active: { status: 'verified' },
    };
    if (!transitions[status]) return null;
    try {
      return await Lawyer.findOneAndUpdate(
        { _id: id, ...transitions[status] },
        {
          $set: {
            status,
            ...(status === 'verified' ? { verifiedAt: new Date(), verifiedBy: String(adminId) } : {}),
          },
        },
        { new: true }
      ).lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao alterar status de advogado:', error.message);
      return null;
    }
  },

  async getDashboardData(telegramId) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
      const lawyer = await Lawyer.findOne({ telegramId: String(telegramId) }).lean();
      if (!lawyer) return null;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [referrals, totalReferrals, referralsThisMonth, conversionAttempts, pendingContacts] = await Promise.all([
        Referral.find({ lawyerId: lawyer._id, createdAt: { $gte: monthStart } }).sort({ createdAt: -1 }).limit(100).lean(),
        Referral.countDocuments({ lawyerId: lawyer._id }),
        Referral.countDocuments({ lawyerId: lawyer._id, createdAt: { $gte: monthStart } }),
        Referral.countDocuments({ lawyerId: lawyer._id, status: { $in: ['contacted', 'converted'] } }),
        Referral.countDocuments({ lawyerId: lawyer._id, status: 'pending' }),
      ]);
      return {
        lawyer,
        referrals,
        totalReferrals,
        referralsThisMonth,
        conversionAttempts,
        pendingContacts,
      };
    } catch (error) {
      console.error('[ERRO DB] Falha ao carregar painel de advogado:', error.message);
      return null;
    }
  },
};

export const dbReferrals = {
  async create(userId, lawyerId, specialization) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
      return await Referral.create({
        userId: String(userId),
        lawyerId,
        specialization,
      });
    } catch (error) {
      console.error('[ERRO DB] Falha ao registrar indicação:', error.message);
      return null;
    }
  },

  async consentAndContact(id, userId, contact) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return null;
    try {
      const referral = await Referral.findOneAndUpdate(
        { _id: id, userId: String(userId), status: 'contacted', userConsent: false },
        {
          $set: { userConsent: true, contact },
        },
        { new: true }
      ).lean();
      return referral;
    } catch (error) {
      console.error('[ERRO DB] Falha ao registrar consentimento:', error.message);
      return null;
    }
  },

  async markContactClick(id, userId) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return null;
    try {
      const referral = await Referral.findOneAndUpdate(
        { _id: id, userId: String(userId), status: 'pending' },
        { $set: { status: 'contacted', contactedAt: new Date() } },
        { new: true }
      ).lean();
      if (referral) return referral;
      const existing = await Referral.findOne({ _id: id, userId: String(userId), status: 'contacted', userConsent: false }).lean();
      return existing || null;
    } catch (error) {
      console.error('[ERRO DB] Falha ao registrar clique em indicação:', error.message);
      return null;
    }
  },

  async getForUser(id, userId) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return null;
    try {
      return await Referral.findOne({ _id: id, userId: String(userId) }).lean();
    } catch (error) {
      console.error('[ERRO DB] Falha ao buscar indicação:', error.message);
      return null;
    }
  },

  async reject(id, userId) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return false;
    try {
      const result = await Referral.updateOne(
        { _id: id, userId: String(userId), status: { $in: ['pending', 'contacted'] }, userConsent: false },
        { $set: { status: 'rejected', userConsent: false } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('[ERRO DB] Falha ao recusar indicação:', error.message);
      return false;
    }
  },

  async markConverted(id, telegramId) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) return false;
    try {
      const lawyer = await Lawyer.findOne({ telegramId: String(telegramId) }).select('_id').lean();
      if (!lawyer) return false;
      const result = await Referral.updateOne(
        { _id: id, lawyerId: lawyer._id, status: { $in: ['pending', 'contacted'] } },
        { $set: { status: 'converted', convertedAt: new Date() } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('[ERRO DB] Falha ao marcar indicação como convertida:', error.message);
      return false;
    }
  },
};
