/**
 * Executa uma função assíncrona com retentativas curtas e backoff
 * exponencial, para chamadas críticas a serviços externos (Telegram/Gemini).
 *
 * Mantém limites conservadores por padrão para não atrasar demais a
 * resposta ao usuário nem sobrecarregar o serviço externo.
 */
export async function withRetry(fn, { retries = 1, baseDelayMs = 300, isRetryable } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = typeof isRetryable === 'function' ? isRetryable(error) : true;

      if (!retryable || attempt === retries) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
