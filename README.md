# ⚖️ Bot Advogado - Assistente Jurídico para Telegram

Bot de Telegram inteligente que oferece consulta jurídica assistida por IA, análise de PDFs legais e geração de documentos personalizados.

## 🚀 Funcionalidades

- 💬 **Consulta Jurídica com IA**: Respostas baseadas em Gemini (Google)
- 📄 **Análise de PDFs**: Envie documentos para análise e obtenha parecer automatizado
- 📝 **Geração de Documentos**: Crie procurações, contratos, petições e mais em DOCX
- 💾 **Histórico de Conversas**: Integração com MongoDB para persistência de dados
- 🔐 **Painel Admin**: Gerenciar histórico e estatísticas via web interface
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

Desenvolvimento local:
```bash
yarn start
```

Produção (com PM2):
```bash
pm2 start index.js --name "bot-advogado"
```

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
| `/novo_caso [título]` | Cria um novo caso e o torna ativo |
| `/casos` | Lista os casos do usuário e destaca o ativo |
| `/caso <número>` | Troca o caso ativo |
| `/admin` | Acessa painel administrativo (admin) |
| `/resetar` | Limpa histórico e casos da conversa (admin) |

## 🗂️ Histórico por Caso

O bot permite organizar as conversas em "casos" independentes por usuário:

- `/novo_caso [título]` cria um novo caso (com título opcional) e o define como ativo. Todas as mensagens seguintes ficam associadas a esse caso.
- `/casos` lista os casos já criados, numerados, indicando qual está ativo no momento.
- `/caso <número>` troca o caso ativo usando o número exibido em `/casos`.

Cada caso mantém seu próprio histórico de mensagens enviado à IA, evitando que o contexto de assuntos diferentes se misture. Requer `MONGODB_URI` configurado; sem banco de dados, os comandos de caso informam que a funcionalidade está indisponível.

## 🏗️ Estrutura do Projeto

```
bot-advogado-telegram/
├── index.js              # 🎯 Servidor Express + webhook Telegram
├── config.js             # ⚙️ Configurações e variáveis de ambiente
├── database.js           # 💾 Conexão MongoDB e persistência
├── gemini.js             # 🤖 Integração com Google Gemini
├── pdf.js                # 📄 Processamento de PDFs
├── word.js               # 📝 Geração de documentos DOCX
├── lib/                  # 🧩 Helpers reutilizáveis (webhook auth, rate limiter, dedup, retry)
├── tests/                # 🧪 Testes automatizados (Vitest)
├── .github/workflows/    # ⚙️ CI (GitHub Actions)
├── package.json          # 📦 Dependências
└── README.md             # 📚 Este arquivo
```

## 🔌 API Endpoints

### Públicos
- `GET /health` - Status do serviço
- `POST /webhook` - Webhook do Telegram (valida `x-telegram-bot-api-secret-token` quando `TELEGRAM_WEBHOOK_SECRET` está configurado)

### Admin (requer `ADMIN_PANEL_KEY`)
- `GET /admin` - Painel web
- `GET /admin/stats` - Estatísticas JSON
- `POST /admin/clear-history` - Limpar histórico global (requer confirmação, veja abaixo)

Autenticação: envie a chave no header `x-admin-key: sua_chave_admin` (recomendado). O uso de `?key=...` na query string continua funcionando apenas por retrocompatibilidade e é registrado como aviso nos logs, pois URLs com chave podem ficar salvas em logs e no histórico do navegador.

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
- ✅ Autenticação do painel admin via header `x-admin-key` (query string mantida só por compatibilidade)
- ✅ Confirmação obrigatória para limpar todo o histórico via painel admin
- ✅ Sanitização de nomes de arquivo
- ✅ Retentativas com backoff curto para chamadas críticas ao Telegram e ao Gemini
- ✅ Tratamento de erros robusto, sem expor segredos/tokens em logs

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
