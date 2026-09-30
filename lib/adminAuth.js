/**
 * Validação compartilhada do acesso ao painel administrativo.
 *
 * Extraído de index.js para ser reutilizado tanto pelas rotas HTML
 * legadas (`/admin/*`) quanto pela API REST (`/api/admin/*`), evitando
 * duplicar a lógica de leitura/validação da chave administrativa.
 */
export function getProvidedAdminKey(req) {
  const headerKey = req.headers['x-admin-key'];
  const queryKey = req.query?.key;
  const bodyKey = req.body?.key;

  if (!headerKey && (queryKey || bodyKey)) {
    console.warn('[ADMIN] Chave recebida via query/body. Prefira o header x-admin-key para evitar exposição em logs/histórico do navegador.');
  }

  return headerKey || queryKey || bodyKey || '';
}

export function isAdminRequestAuthorized(req, adminPanelKey) {
  if (!adminPanelKey) return false;
  return getProvidedAdminKey(req) === adminPanelKey;
}
