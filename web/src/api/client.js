const BASE_URL = '/api';

async function request(path, { method = 'GET', body, headers } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Erro inesperado (HTTP ${response.status}).`);
  }

  return data;
}

export const api = {
  register: (email, password, name) => request('/auth/register', { method: 'POST', body: { email, password, name } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  specializations: () => request('/specializations'),

  chat: (message, caseId) => request('/chat', { method: 'POST', body: { message, caseId } }),

  listCases: () => request('/cases'),
  createCase: (title, specialization) => request('/cases', { method: 'POST', body: { title, specialization } }),
  selectCase: (id) => request(`/cases/${id}/select`, { method: 'PATCH' }),
  caseMessages: (id) => request(`/cases/${id}/messages`),

  analyzePdf: (filename, contentBase64, question, caseId) => request('/documents/analyze-pdf', {
    method: 'POST',
    body: { filename, contentBase64, question, caseId },
  }),

  lawyers: (specialization, state) => {
    const params = new URLSearchParams();
    if (specialization) params.set('specialization', specialization);
    if (state) params.set('state', state);
    return request(`/lawyers?${params.toString()}`);
  },
  registerLawyer: (profile) => request('/lawyers/register', { method: 'POST', body: profile }),

  adminStats: (adminKey) => request('/admin/stats', { headers: { 'x-admin-key': adminKey } }),
  adminLawyers: (adminKey) => request('/admin/lawyers', { headers: { 'x-admin-key': adminKey } }),
  adminSetLawyerStatus: (adminKey, id, status) => request(`/admin/lawyers/${id}/status`, {
    method: 'PATCH',
    body: { status },
    headers: { 'x-admin-key': adminKey },
  }),
};

export async function generateDocument(title, content) {
  const response = await fetch(`${BASE_URL}/documents/generate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Não foi possível gerar o documento.');
  }

  return response.blob();
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}
