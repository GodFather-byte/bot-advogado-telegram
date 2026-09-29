import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = ['TELEGRAM_BOT_TOKEN'];

export function validateConfig() {
  const missing = requiredEnv.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  mongodbUri: process.env.MONGODB_URI,
  maxPdfCharacters: Number(process.env.MAX_PDF_CHARACTERS || 30000),
  historyLimit: Number(process.env.HISTORY_LIMIT || 20),
  adminUserIds: String(process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 10),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  botName: process.env.BOT_NAME || 'Assistente Jurídico',
};
