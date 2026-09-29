import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../lib/retry.js';

describe('withRetry', () => {
  it('retorna o resultado imediatamente quando a função não falha', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 2, baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('tenta novamente após uma falha e retorna sucesso na segunda tentativa', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('falha temporária'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { retries: 1, baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propaga o erro após esgotar as tentativas', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('falha persistente'));

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('falha persistente');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('não tenta novamente quando isRetryable retorna false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('erro não recuperável'));

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1, isRetryable: () => false }))
      .rejects.toThrow('erro não recuperável');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
