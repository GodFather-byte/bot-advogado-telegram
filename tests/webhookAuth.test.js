import { describe, expect, it } from 'vitest';
import { isValidWebhookSecret } from '../lib/webhookAuth.js';

describe('isValidWebhookSecret', () => {
  it('permite qualquer valor (modo compatibilidade) quando nenhum segredo está configurado', () => {
    expect(isValidWebhookSecret(undefined, '')).toBe(true);
    expect(isValidWebhookSecret('qualquer-coisa', '')).toBe(true);
  });

  it('aceita quando o header corresponde ao segredo configurado', () => {
    expect(isValidWebhookSecret('meu-segredo', 'meu-segredo')).toBe(true);
  });

  it('rejeita quando o header não corresponde ao segredo configurado', () => {
    expect(isValidWebhookSecret('errado', 'meu-segredo')).toBe(false);
  });

  it('rejeita quando o header está ausente mas o segredo está configurado', () => {
    expect(isValidWebhookSecret(undefined, 'meu-segredo')).toBe(false);
    expect(isValidWebhookSecret('', 'meu-segredo')).toBe(false);
  });
});
