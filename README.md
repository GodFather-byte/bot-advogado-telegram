# Bot Advogado Telegram

Assistente jurídico para Telegram com respostas usando Gemini, histórico opcional em MongoDB, análise de PDFs e geração de documentos `.docx`.

> **Aviso importante:** o bot fornece informações educacionais e não substitui consulta, parecer ou representação por um advogado habilitado.

## Funcionalidades

- Atendimento por texto com Google Gemini.
- Análise de arquivos PDF enviados pelo Telegram.
- Geração de documentos `.docx` quando solicitado à IA.
- Histórico de conversas opcional com MongoDB Atlas.
- Comandos `/start`, `/help`, `/status` e `/sobre`.
- Endpoint `GET /health` para monitoramento.
- Validação de configuração, limites de tamanho e tratamento de erros.

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Variáveis obrigatórias:

- `TELEGRAM_BOT_TOKEN`: token obtido no BotFather.
- `GEMINI_API_KEY`: chave da API Gemini.

`MONGODB_URI` é opcional. Sem ela, o bot continua funcionando, mas não mantém histórico entre mensagens.

## Execução

```bash
npm start
```

Configure o webhook do Telegram apontando para `https://seu-dominio.com/webhook`. O endpoint `/health` pode ser usado por serviços como Render, Railway ou Fly.io.

## Estrutura

- `index.js`: servidor HTTP, webhook e fluxo do Telegram.
- `config.js`: configuração e validação das variáveis de ambiente.
- `gemini.js`: integração com a IA.
- `database.js`: persistência opcional do histórico.
- `pdf.js`: download e extração de texto dos PDFs.
- `word.js`: geração de documentos Word.
