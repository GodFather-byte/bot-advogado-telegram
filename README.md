# ⚖️ Bot Advogado - Assistente Jurídico para Telegram

Bot de Telegram inteligente que oferece consulta jurídica assistida por IA, análise de PDFs legais e geração de documentos personalizados.

## 🚀 Funcionalidades

- 💬 **Consulta Jurídica com IA**: Respostas baseadas em Gemini (Google)
- 📄 **Análise de PDFs**: Envie documentos para análise e obtenha parecer automatizado
- 📝 **Geração de Documentos**: Crie procurações, contratos, petições e mais em DOCX
- 💾 **Histórico de Conversas**: Integração com MongoDB para persistência de dados
- 🔐 **Painel Admin**: Gerenciar histórico e estatísticas via web interface
- ⏱️ **Rate Limiting**: Proteção contra abuso de taxa de requisições

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
```

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
| `/resetar` | Limpa histórico da conversa (admin) |

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
├── package.json          # 📦 Dependências
└── README.md             # 📚 Este arquivo
```

## 🔌 API Endpoints

### Públicos
- `GET /health` - Status do serviço
- `POST /webhook` - Webhook do Telegram

### Admin (requer `ADMIN_PANEL_KEY`)
- `GET /admin?key=...` - Painel web
- `GET /admin/stats?key=...` - Estatísticas JSON
- `POST /admin/clear-history?key=...` - Limpar histórico global

## 🛡️ Segurança

- ✅ Validação de variáveis de ambiente obrigatórias
- ✅ Rate limiting por usuário
- ✅ Autenticação do painel admin via chave
- ✅ Sanitização de nomes de arquivo
- ✅ Tratamento de erros robusto

## 📊 Monitoramento

Acesse o painel administrativo:
```
https://seu-dominio.com/admin?key=sua_chave_admin
```

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
