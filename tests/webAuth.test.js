import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  hashPassword,
  parseCookies,
  serializeSessionCookie,
  verifyPassword,
  verifySessionToken,
} from '../lib/webAuth.js';

describe('hashPassword / verifyPassword', () => {
  it('permite verificar a senha correta a partir do hash armazenado', () => {
    const stored = hashPassword('minhaSenhaForte123');
    expect(verifyPassword('minhaSenhaForte123', stored)).toBe(true);
  });

  it('rejeita senha incorreta', () => {
    const stored = hashPassword('minhaSenhaForte123');
    expect(verifyPassword('outraSenha', stored)).toBe(false);
  });

  it('gera hashes diferentes (salt aleatório) para a mesma senha', () => {
    expect(hashPassword('mesma-senha')).not.toBe(hashPassword('mesma-senha'));
  });

  it('rejeita valores de hash malformados sem lançar erro', () => {
    expect(verifyPassword('qualquer', 'hash-sem-separador')).toBe(false);
    expect(verifyPassword('qualquer', '')).toBe(false);
  });
});

describe('createSessionToken / verifySessionToken', () => {
  const secret = 'segredo-de-teste';

  it('verifica um token recém-criado como válido', () => {
    const token = createSessionToken({ userId: 'abc123' }, secret, 60000);
    const decoded = verifySessionToken(token, secret);
    expect(decoded?.userId).toBe('abc123');
  });

  it('rejeita token expirado', () => {
    const now = Date.now();
    const token = createSessionToken({ userId: 'abc123' }, secret, 1000, now - 5000);
    expect(verifySessionToken(token, secret, now)).toBeNull();
  });

  it('rejeita token assinado com outro segredo', () => {
    const token = createSessionToken({ userId: 'abc123' }, secret, 60000);
    expect(verifySessionToken(token, 'outro-segredo')).toBeNull();
  });

  it('rejeita token malformado', () => {
    expect(verifySessionToken('token-invalido', secret)).toBeNull();
    expect(verifySessionToken(undefined, secret)).toBeNull();
  });
});

describe('parseCookies / serializeSessionCookie', () => {
  it('extrai cookies do header Cookie', () => {
    const req = { headers: { cookie: 'session=abc123; other=xyz' } };
    expect(parseCookies(req)).toEqual({ session: 'abc123', other: 'xyz' });
  });

  it('retorna objeto vazio quando não há header de cookie', () => {
    expect(parseCookies({ headers: {} })).toEqual({});
  });

  it('serializa cookie de sessão com atributos de segurança esperados', () => {
    const cookie = serializeSessionCookie('session', 'token-valor', { maxAgeMs: 60000 });
    expect(cookie).toContain('session=token-valor');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=60');
  });
});
