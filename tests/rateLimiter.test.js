import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../lib/rateLimiter.js';

describe('createRateLimiter', () => {
  it('permite requisições até o limite configurado dentro da janela', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60000 });

    expect(limiter.isRateLimited('user-1')).toBe(false);
    expect(limiter.isRateLimited('user-1')).toBe(false);
    expect(limiter.isRateLimited('user-1')).toBe(false);
    expect(limiter.isRateLimited('user-1')).toBe(true);
  });

  it('mantém limites independentes por chave', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60000 });

    expect(limiter.isRateLimited('user-a')).toBe(false);
    expect(limiter.isRateLimited('user-b')).toBe(false);
    expect(limiter.isRateLimited('user-a')).toBe(true);
    expect(limiter.isRateLimited('user-b')).toBe(true);
  });

  it('libera novamente após a janela expirar', async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 20 });

    expect(limiter.isRateLimited('user-1')).toBe(false);
    expect(limiter.isRateLimited('user-1')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(limiter.isRateLimited('user-1')).toBe(false);
  });

  it('cleanup remove usuários inativos do mapa, evitando crescimento de memória', async () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 20 });

    limiter.isRateLimited('user-1');
    limiter.isRateLimited('user-2');
    expect(limiter.size()).toBe(2);

    await new Promise((resolve) => setTimeout(resolve, 40));
    limiter.cleanup();

    expect(limiter.size()).toBe(0);
  });
});
