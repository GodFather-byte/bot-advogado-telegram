/**
 * Cache de curto prazo para deduplicar `update_id` do Telegram.
 *
 * O Telegram pode reenviar o mesmo update em cenários de retry de webhook.
 * Este cache guarda os IDs vistos recentemente com um TTL para evitar
 * processar a mesma atualização duas vezes, sem crescer indefinidamente.
 */
export function createUpdateDeduplicator({ ttlMs = 5 * 60 * 1000, maxSize = 5000 } = {}) {
  const seen = new Map();

  function prune(now) {
    for (const [id, expiresAt] of seen) {
      if (expiresAt <= now) {
        seen.delete(id);
      }
    }
  }

  function isDuplicate(updateId) {
    if (updateId === undefined || updateId === null) return false;

    const now = Date.now();
    prune(now);

    const key = String(updateId);
    if (seen.has(key)) {
      return true;
    }

    if (seen.size >= maxSize) {
      const oldestKey = seen.keys().next().value;
      if (oldestKey !== undefined) seen.delete(oldestKey);
    }

    seen.set(key, now + ttlMs);
    return false;
  }

  function size() {
    return seen.size;
  }

  return { isDuplicate, size };
}
