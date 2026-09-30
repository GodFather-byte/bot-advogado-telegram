import { createHmac, timingSafeEqual } from 'node:crypto';

const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

export function parseOab(value) {
  const input = String(value || '').trim().toUpperCase();
  if (input.length > 16) return null;
  const match = input.replace(/\s/g, '').match(/^([A-Z]{2})[-/]?(\d{4,8})$/);
  if (!match || !BRAZILIAN_STATES.has(match[1])) return null;
  return { state: match[1], number: `${match[1]}${match[2]}` };
}

export function isValidBrazilianState(value) {
  return BRAZILIAN_STATES.has(String(value || '').trim().toUpperCase());
}

export function createLawyerDashboardToken(telegramId, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    telegramId: String(telegramId),
    expiresAt: now + 15 * 60 * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyLawyerDashboardToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return null;
  const [payload, suppliedSignature, ...extra] = token.split('.');
  if (!payload || !suppliedSignature || extra.length) return null;

  const expectedSignature = createHmac('sha256', secret).update(payload).digest();
  let provided;
  try {
    provided = Buffer.from(suppliedSignature, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expectedSignature.length || !timingSafeEqual(provided, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!/^\d+$/.test(decoded.telegramId) || !Number.isFinite(decoded.expiresAt) || decoded.expiresAt <= now) return null;
    return decoded.telegramId;
  } catch {
    return null;
  }
}
