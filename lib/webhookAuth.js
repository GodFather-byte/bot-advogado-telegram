import crypto from 'node:crypto';

/**
 * Valida o segredo enviado pelo Telegram no header
 * `x-telegram-bot-api-secret-token` contra o segredo configurado.
 *
 * Quando nenhum segredo está configurado, o modo de compatibilidade é
 * mantido e a validação sempre passa (comportamento atual preservado).
 */
export function isValidWebhookSecret(receivedSecret, configuredSecret) {
  if (!configuredSecret) return true;
  if (!receivedSecret) return false;

  const received = Buffer.from(String(receivedSecret));
  const expected = Buffer.from(String(configuredSecret));

  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(received, expected);
}
