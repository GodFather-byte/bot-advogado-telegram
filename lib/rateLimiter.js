/**
 * Rate limiter simples baseado em janela deslizante por chave (ex.: chatId).
 *
 * Diferente de um Map que só cresce, este limitador remove periodicamente
 * entradas cujos timestamps já saíram da janela configurada, evitando
 * crescimento de memória para usuários que enviaram mensagens no passado
 * mas não estão mais ativos.
 */
export function createRateLimiter({ limit, windowMs, cleanupIntervalMs } = {}) {
  const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
  const safeWindowMs = Number(windowMs) > 0 ? Number(windowMs) : 60000;
  const hits = new Map();
  let timer;

  function prune(key, now) {
    const entries = hits.get(key);
    if (!entries) return [];

    const filtered = entries.filter((timestamp) => now - timestamp < safeWindowMs);
    if (filtered.length) {
      hits.set(key, filtered);
    } else {
      hits.delete(key);
    }

    return filtered;
  }

  function isRateLimited(key) {
    const id = String(key);
    const now = Date.now();
    const filtered = prune(id, now);

    if (filtered.length >= safeLimit) {
      return true;
    }

    filtered.push(now);
    hits.set(id, filtered);
    return false;
  }

  function cleanup() {
    const now = Date.now();
    for (const key of Array.from(hits.keys())) {
      prune(key, now);
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(cleanup, cleanupIntervalMs || safeWindowMs);
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function size() {
    return hits.size;
  }

  return { isRateLimited, cleanup, start, stop, size };
}
