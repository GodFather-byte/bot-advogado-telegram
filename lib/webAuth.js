import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const SCRYPT_KEYLEN = 64;

/**
 * Hash de senha usando scrypt (nativo do Node, sem dependências extras).
 * Formato armazenado: "<salt-hex>:<hash-hex>".
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;

  try {
    const derived = scryptSync(String(password), salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, 'hex');
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

/**
 * Token de sessão assinado (HMAC), no mesmo estilo dos tokens temporários
 * do painel de advogado (lib/lawyers.js), evitando adicionar uma
 * dependência de JWT só para a API web.
 */
export function createSessionToken(payload, secret, ttlMs = SESSION_TTL_MS, now = Date.now()) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, expiresAt: now + ttlMs })).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return null;
  const [encoded, suppliedSignature, ...extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra.length) return null;

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest();
  let provided;
  try {
    provided = Buffer.from(suppliedSignature, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expectedSignature.length || !timingSafeEqual(provided, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!Number.isFinite(decoded.expiresAt) || decoded.expiresAt <= now) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie;
  const cookies = {};
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function serializeSessionCookie(name, value, { maxAgeMs } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  if (typeof maxAgeMs === 'number') parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  return parts.join('; ');
}

export function clearSessionCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const SESSION_COOKIE_NAME = 'session';
export { SESSION_TTL_MS };
