import { describe, expect, it } from 'vitest';
import { createUpdateDeduplicator } from '../lib/dedup.js';

describe('createUpdateDeduplicator', () => {
  it('não considera duplicado quando update_id está ausente', () => {
    const dedup = createUpdateDeduplicator();
    expect(dedup.isDuplicate(undefined)).toBe(false);
    expect(dedup.isDuplicate(undefined)).toBe(false);
  });

  it('detecta o mesmo update_id como duplicado na segunda ocorrência', () => {
    const dedup = createUpdateDeduplicator();
    expect(dedup.isDuplicate(123)).toBe(false);
    expect(dedup.isDuplicate(123)).toBe(true);
  });

  it('trata update_ids diferentes como não duplicados', () => {
    const dedup = createUpdateDeduplicator();
    expect(dedup.isDuplicate(1)).toBe(false);
    expect(dedup.isDuplicate(2)).toBe(false);
    expect(dedup.size()).toBe(2);
  });

  it('expira entradas após o TTL configurado', async () => {
    const dedup = createUpdateDeduplicator({ ttlMs: 10 });
    expect(dedup.isDuplicate(5)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(dedup.isDuplicate(5)).toBe(false);
  });

  it('limita o tamanho máximo do cache removendo entradas antigas', () => {
    const dedup = createUpdateDeduplicator({ maxSize: 2 });
    dedup.isDuplicate(1);
    dedup.isDuplicate(2);
    dedup.isDuplicate(3);
    expect(dedup.size()).toBeLessThanOrEqual(2);
  });
});
