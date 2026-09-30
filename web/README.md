# Portal Web - Assistente Jurídico

Frontend React + Vite do MVP web do bot jurídico. Consome a API REST exposta pelo backend Express em `/api/*` (veja o README principal do repositório).

## Desenvolvimento

```bash
npm install
npm run dev
```

O Vite roda em `http://localhost:5173` e faz proxy de `/api` para `http://localhost:3000` (backend). Ajuste o destino do proxy com a variável `VITE_API_PROXY_TARGET`, se necessário.

## Build de produção

```bash
npm run build
```

Gera os arquivos estáticos em `dist/`, que podem ser servidos por qualquer host estático (Vercel, Netlify, Nginx, etc.) ou pelo próprio Express.

## Estrutura

- `src/pages/` — telas (login, registro, dashboard, chat, casos, upload de PDF, geração de documentos, advogados, admin)
- `src/components/` — layout e proteção de rotas autenticadas
- `src/context/AuthContext.jsx` — estado de sessão do usuário
- `src/api/client.js` — cliente `fetch` para a API REST (cookies de sessão via `credentials: 'include'`)
