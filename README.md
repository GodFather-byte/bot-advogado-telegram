# ⚖️ Bot Advogado - Assistente Jurídico (Telegram + Web)

Assistente jurídico com IA disponível tanto como **bot de Telegram** quanto como **aplicação web** (React + API REST), oferecendo consulta jurídica assistida por IA, análise de PDFs legais e geração de documentos personalizados.

## 🚀 Funcionalidades

- 💬 **Consulta Jurídica com IA**: Respostas baseadas em Gemini (Google), no Telegram e na web
- ⚖️ **Especialização jurídica**: Contexto específico para sete áreas, associado ao usuário e ao caso ativo
- 👩‍⚖️ **Rede de advogados**: Cadastro, análise administrativa, recomendações e acompanhamento de indicações, sem integração de pagamentos
- 📄 **Análise de PDFs**: Envie documentos para análise e obtenha parecer automatizado (Telegram ou upload web)
- 📝 **Geração de Documentos**: Crie procurações, contratos, petições e mais em DOCX
- 💾 **Histórico de Conversas**: Integração com MongoDB para persistência de dados
- 🌐 **Portal Web (MVP)**: Frontend em React/Vite (`web/`) com login, chat, casos, upload de PDF e geração de documentos
- 🔌 **API REST**: Endpoints `/api/*` reaproveitando toda a lógica existente do bot (gemini.js, pdf.js, word.js, database.js)
- 🔐 **Painel Admin**: Gerenciar histórico e estatísticas via web interface (HTML legado) ou via API (`/api/admin/*`) consumida pelo painel React
- ⏱️ **Rate Limiting**: Proteção contra abuso de taxa de requisições
- 🔒 **Webhook Seguro**: Validação de segredo do Telegram no endpoint `/webhook`
- 🔁 **Deduplicação de Updates**: Evita processar o mesmo update do Telegram duas vezes
- ⌨️ **Indicador de digitação**: Feedback "digitando..." durante análise de PDF/IA

## 📋 Pré-requisitos

- Node.js 18+ 
- Conta Telegram com Bot Token (via [@BotFather](https://t.me/botfather))
- Chave API do Google Gemini
- MongoDB Atlas (opcional, para histórico)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/GodFather-byte/bot-advogado-telegram.git
cd bot-advogado-telegram
```

2. Instale as dependências:
```bash
yarn install
# ou
npm install
```

3. Configure as variáveis de ambiente (crie um arquivo `.env`):
```bash
# OBRIGATÓRIO
TELEGRAM_BOT_TOKEN=seu_token_aqui

# OPCIONAL
GEMINI_API_KEY=sua_chave_gemini
MONGODB_URI=seu_url_mongodb_atlas
PORT=3000
PUBLIC_URL=https://seu-dominio.com
ADMIN_PANEL_KEY=sua_chave_admin
ADMIN_USER_IDS=123456789,987654321

# RECOMENDADO EM PRODUÇÃO
TELEGRAM_WEBHOOK_SECRET=uma_string_aleatoria_longa
```

### 🔒 Configurando o segredo do webhook

O Telegram permite registrar um `secret_token` ao configurar o webhook, que é reenviado no header `x-telegram-bot-api-secret-token` em toda chamada. Isso evita que terceiros chamem seu endpoint `/webhook` fingindo ser o Telegram.

1. Gere um valor aleatório e defina em `TELEGRAM_WEBHOOK_SECRET` no `.env`.
2. Registre o mesmo valor ao configurar o webhook:
```bash
curl -F "url=https://seu-dominio.com/webhook" \
     -F "secret_token=uma_string_aleatoria_longa" \
     https://api.telegram.org/bot<SEU_TOKEN>/setWebhook
```
3. Sem `TELEGRAM_WEBHOOK_SECRET` configurado, o bot mantém o modo de compatibilidade atual (sem validação do header). Com a variável definida, requisições sem o header correto recebem `401`.

## 🏃 Execução

### Backend (bot + API REST)

Desenvolvimento local:
```bash
yarn start
# ou
npm start
```
O servidor sobe em `http://localhost:3000` por padrão, expondo `/webhook`, `/health`, `/admin/*` (HTML legado) e `/api/*` (REST).

Produção (com PM2):
```bash
pm2 start index.js --name "bot-advogado"
```

### Frontend web (MVP em React + Vite)

O frontend fica em `web/` e consome a API REST do backend. Em desenvolvimento, o Vite faz proxy de `/api` para `http://localhost:3000` (configurável via `VITE_API_PROXY_TARGET`).

```bash
npm run web:install   # instala as dependências do frontend (uma vez)
npm run web:dev        # inicia o Vite em http://localhost:5173
```

Com o backend rodando em outra aba/terminal (`npm start`), acesse `http://localhost:5173` para usar o portal web: criar conta, conversar com a IA, gerenciar casos, enviar PDFs e gerar documentos.

Build de produção do frontend:
```bash
npm run web:build       # gera web/dist, que pode ser servido por qualquer host estático
```

Defina `WEB_APP_ORIGIN` no `.env` do backend com a origem do frontend (ex.: `http://localhost:5173` em dev, ou o domínio do site em produção) para liberar o CORS da API.

## 🌐 Deployment

### Render.com

1. Connect seu repositório GitHub ao Render
2. Configure as variáveis de ambiente no dashboard
3. Defina o comando de build: `yarn install`
4. Defina o comando de start: `node index.js`
5. Deploy!

**Variáveis obrigatórias no Render:**
- `TELEGRAM_BOT_TOKEN` ⚠️ Sem isso, o bot não iniciará

### Outros Serviços

Também compatível com:
- Heroku
- Railway
- AWS EC2
- DigitalOcean
- Qualquer host com Node.js

## 📖 Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `/start` | Inicia o atendimento |
| `/help` | Mostra lista de comandos |
| `/status` | Verifica se bot está online |
| `/sobre` | Informações sobre o bot |
| `/documentos` | Tipos de documentos disponíveis |
| `/especialidade` | Escolhe uma das sete áreas jurídicas; também aceita um número ou código |
| `/minha_especialidade` | Mostra a área jurídica atual |
| `/minha_localizacao <UF, cidade>` | Define a localização usada para priorizar recomendações |
| `/advogados` | Mostra até três advogados ativos da sua especialidade |
| `/novo_caso [título]` | Cria um novo caso e o torna ativo |
| `/casos` | Lista os casos do usuário e destaca o ativo |
| `/caso <número>` | Troca o caso ativo |
| `/registrar_advogado` | Inicia o cadastro de advogado (requer aprovação administrativa) |
| `/meu_perfil` | Mostra o perfil e as estatísticas do advogado |
| `/editar_perfil <campo> <valor>` | Edita bio, telefone, especialidades, cidade, estado ou username do Telegram |
| `/dashboard_advogado` | Gera um link temporário e assinado para o painel de indicações |
| `/marcar_indicacao <id> convertida` | Registra manualmente uma conversão |
| `/admin` | Acessa painel administrativo (admin) |
| `/resetar` | Limpa histórico e casos da conversa (admin) |

## 🗂️ Histórico por Caso

O bot permite organizar as conversas em "casos" independentes por usuário:

- `/novo_caso [título]` cria um novo caso (com título opcional) e o define como ativo. Todas as mensagens seguintes ficam associadas a esse caso.
- `/casos` lista os casos já criados, numerados, indicando qual está ativo no momento.
- `/caso <número>` troca o caso ativo usando o número exibido em `/casos`.
- `/especialidade` define a área do usuário; `/novo_caso` salva a área escolhida no novo caso. Ao alternar casos, a IA usa a especialidade daquele caso, quando definida.
- O catálogo (Família, Trabalhista, Civil, Imobiliário, Tributário, Criminal e Empresarial), incluindo seus prompts, referências legislativas e palavras-chave, é atualizado na coleção `specializations` ao conectar ao MongoDB.

Cada caso mantém seu próprio histórico de mensagens enviado à IA, evitando que o contexto de assuntos diferentes se misture. A especialidade informa à IA a área, as referências e o tribunal estadual pertinente. O prompt orienta a não inventar citações: decisões recentes STF/STJ e precedentes estaduais devem ser identificáveis e verificáveis; sem fonte atual, a resposta deve explicitar essa limitação.

## 👩‍⚖️ Rede de advogados (sem pagamentos)

- `/registrar_advogado` solicita nome, OAB/UF, áreas, estado/cidade, telefone, breve bio e username do Telegram. O formato da OAB é validado antes do envio; o cadastro fica como `pending_verification`.
- No painel `/admin`, administradores podem verificar a OAB e, em uma etapa separada, ativar o perfil. Somente perfis `active` são recomendados.
- `/advogados` recomenda até três perfis ativos da especialidade escolhida, priorizando o estado informado em `/minha_localizacao`. Consultas jurídicas consideradas complexas também podem exibir recomendações. Não há cobrança ou comissão automatizada.
- Ao tocar em **Enviar mensagem**, o usuário precisa consentir explicitamente. Nome e Telegram só são compartilhados com o advogado após o consentimento; sem ele, o referral fica sem contato.
- `/meu_perfil` e `/dashboard_advogado` permitem consultar perfil e indicações. O link do painel é assinado e expira em 15 minutos; solicite um novo pelo bot quando expirar. Conversões podem ser marcadas no painel ou por `/marcar_indicacao`.

## 🏗️ Estrutura do Projeto

```
bot-advogado-telegram/
├── index.js              # 🎯 Servidor Express + webhook Telegram + rotas /admin (HTML)
├── config.js             # ⚙️ Configurações e variáveis de ambiente
├── database.js           # 💾 Conexão MongoDB e persistência (bot + web)
├── gemini.js             # 🤖 Integração com Google Gemini
├── pdf.js                # 📄 Processamento de PDFs (Telegram e upload web)
├── word.js               # 📝 Geração de documentos DOCX
├── lib/                  # 🧩 Helpers reutilizáveis (webhook auth, admin auth, auth web, rate limiter, dedup, retry, especialidades)
├── routes/
│   └── api.js             # 🔌 API REST consumida pelo frontend web (/api/*)
├── web/                  # 🌐 Frontend React + Vite (portal web MVP)
│   ├── src/
│   │   ├── pages/         # Login, Registro, Dashboard, Chat, Casos, PDF, Documentos, Advogados, Admin
│   │   ├── components/    # Layout, RequireAuth
│   │   ├── context/       # AuthContext (sessão do usuário web)
│   │   └── api/           # Cliente fetch para a API REST
│   └── vite.config.js
├── tests/                # 🧪 Testes automatizados (Vitest)
├── .github/workflows/    # ⚙️ CI (GitHub Actions)
├── package.json          # 📦 Dependências do backend
└── README.md             # 📚 Este arquivo
```

## 🔌 API Endpoints

### Bot do Telegram (legado, sem alterações)
- `GET /health` - Status do serviço
- `POST /webhook` - Webhook do Telegram (valida `x-telegram-bot-api-secret-token` quando `TELEGRAM_WEBHOOK_SECRET` está configurado)
- `GET /admin`, `POST /admin/lawyers/:id/status`, `GET /admin/stats`, `POST /admin/clear-history` - Painel HTML legado (requer `ADMIN_PANEL_KEY`)
- `GET /admin/lawyer-dashboard`, `POST /admin/lawyer-dashboard/convert` - Painel do advogado (token assinado emitido pelo bot)

### API REST (`/api/*`), consumida pelo frontend web em `web/`

**Autenticação (sessão via cookie `httpOnly`)**
- `POST /api/auth/register` - Cria conta (`email`, `password`, `name`)
- `POST /api/auth/login` - Login (`email`, `password`)
- `POST /api/auth/logout` - Encerra a sessão
- `GET /api/auth/me` - Retorna o usuário autenticado

**Chat e casos** (requerem sessão autenticada)
- `GET /api/specializations` - Lista as áreas jurídicas disponíveis
- `POST /api/chat` - Envia mensagem ao Gemini (`message`, `caseId` opcional)
- `GET /api/cases` - Lista os casos do usuário
- `POST /api/cases` - Cria um novo caso (`title`, `specialization` opcionais)
- `PATCH /api/cases/:id/select` - Define o caso ativo
- `GET /api/cases/:id/messages` - Histórico de mensagens do caso

**Documentos**
- `POST /api/documents/analyze-pdf` - Analisa um PDF enviado em base64 (`contentBase64`, `filename`, `question`, `caseId` opcionais; limite de 8MB)
- `POST /api/documents/generate` - Gera e retorna um `.docx` (`title`, `content`)

**Advogados**
- `GET /api/lawyers?specialization=...&state=...` - Busca advogados ativos por especialidade
- `POST /api/lawyers/register` - Cadastra um advogado (requer sessão autenticada; fica `pending_verification` até aprovação administrativa)

**Administração (requer header `x-admin-key`, mesma chave `ADMIN_PANEL_KEY`)**
- `GET /api/admin/stats` - Estatísticas gerais
- `GET /api/admin/lawyers` - Lista advogados pendentes/verificados
- `PATCH /api/admin/lawyers/:id/status` - Avança o status do advogado (`verified` → `active`)

Autenticação do painel admin (rotas legadas e API): envie a chave no header `x-admin-key: sua_chave_admin` (recomendado). O uso de `?key=...` na query string continua funcionando apenas por retrocompatibilidade e é registrado como aviso nos logs, pois URLs com chave podem ficar salvas em logs e no histórico do navegador. **A chave nunca é embutida no bundle do frontend** — o painel web (`/admin` no React) pede que o administrador a digite a cada acesso, exatamente como o painel HTML legado.

`POST /admin/clear-history` é uma ação destrutiva e exige o campo `confirm` com o valor exato `CONFIRMAR` no corpo da requisição, além da autenticação:
```bash
curl -X POST https://seu-dominio.com/admin/clear-history \
     -H "x-admin-key: sua_chave_admin" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "confirm=CONFIRMAR"
```

## 🛡️ Segurança

- ✅ Validação de variáveis de ambiente obrigatórias
- ✅ Webhook protegido por segredo compartilhado (`TELEGRAM_WEBHOOK_SECRET`), com resposta `401` em caso de segredo inválido
- ✅ Deduplicação de `update_id` do Telegram, evitando processamento duplicado
- ✅ Rate limiting por usuário com limpeza periódica de usuários inativos (evita crescimento de memória)
- ✅ Autenticação do painel admin via header `x-admin-key` (query string mantida só por compatibilidade), reutilizada pelas rotas HTML legadas e pela API REST
- ✅ Confirmação obrigatória para limpar todo o histórico via painel admin
- ✅ Sanitização de nomes de arquivo
- ✅ Retentativas com backoff curto para chamadas críticas ao Telegram e ao Gemini
- ✅ Tratamento de erros robusto, sem expor segredos/tokens em logs
- ✅ Sessão da API web assinada (HMAC) e armazenada em cookie `httpOnly`/`SameSite=Lax` (e `Secure` em produção); nunca em `localStorage`
- ✅ Senhas da conta web com hash + salt via `scrypt` (nativo do Node, sem dependências extras)
- ✅ Nenhum segredo (`GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_PANEL_KEY`) é enviado ao frontend; o painel admin do React solicita a chave a cada acesso, apenas para uso imediato na requisição
- ✅ Upload de PDF validado por extensão e limite de tamanho (8MB) antes do processamento
- ✅ CORS da API restrito às origens configuradas em `WEB_APP_ORIGIN`

## 🧪 Testes

O projeto usa [Vitest](https://vitest.dev/) para testes automatizados leves e compatíveis com ESM.

```bash
npm test         # roda todos os testes uma vez
npm run test:watch  # modo watch, útil durante o desenvolvimento
```

Os testes cobrem, entre outros pontos:
- Validação do segredo do webhook (`lib/webhookAuth.js`)
- Deduplicação de `update_id` (`lib/dedup.js`)
- Rate limiting básico e limpeza de usuários inativos (`lib/rateLimiter.js`)
- Retentativas com backoff (`lib/retry.js`)
- Reset seguro de dados do usuário quando o MongoDB está indisponível (`database.js`)
- Hash/verificação de senha e tokens de sessão da API web (`lib/webAuth.js`)


## 🔁 Deduplicação e limites

- Cada update do Telegram traz um `update_id`; o bot mantém um cache em memória de curto prazo (TTL) desses IDs para não processar o mesmo update duas vezes em caso de reenvio pelo Telegram.
- O webhook também aceita `edited_message`, processando-a como uma mensagem normal quando não há `message` no payload.
- O rate limiter usa uma janela deslizante configurável (`RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_WINDOW_MS`) e limpa periodicamente entradas de usuários que pararam de enviar mensagens.

## ⚙️ CI

Um workflow do GitHub Actions (`.github/workflows/ci.yml`) roda os testes automaticamente em cada push/PR para `main`, nas versões Node 18.x e 20.x, com cache de dependências via `npm ci`.

## 📊 Monitoramento

Acesse o painel administrativo enviando a chave via header (recomendado):
```bash
curl -H "x-admin-key: sua_chave_admin" https://seu-dominio.com/admin
```

Para navegação via browser, o acesso por query string (`?key=sua_chave_admin`) ainda é aceito por retrocompatibilidade, mas evite compartilhar esse link.

Métricas disponíveis:
- Total de mensagens salvas
- Usuários distintos
- Última mensagem recebida
- Configurações ativas

## 🐛 Troubleshooting

### "Application exited early" no Render
- Verifique se `TELEGRAM_BOT_TOKEN` está configurado
- Verifique logs: `yarn start` localmente
- Confirme se o repositório está com os arquivos corretos

### Bot não responde no Telegram
- Valide o `TELEGRAM_BOT_TOKEN`
- Certifique-se de que `PUBLIC_URL` está configurado
- Verifique se o webhook foi registrado: `GET https://api.telegram.org/bot{TOKEN}/getWebhookInfo`

### Erro de conexão MongoDB
- Valide a `MONGODB_URI`
- Whitelist o IP do servidor na MongoDB Atlas
- Verifique as credenciais de acesso

## 📝 Licença

[Adicione sua licença aqui]

## 🤝 Contribuições

Pull requests são bem-vindas! Para mudanças maiores, abra uma issue primeiro.

## 💬 Suporte

Encontrou um bug? [Abra uma issue](https://github.com/GodFather-byte/bot-advogado-telegram/issues)

---

**⚠️ Aviso Legal**: Este bot fornece informações educacionais e não substitui orientação de um advogado qualificado.
