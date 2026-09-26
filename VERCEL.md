# Guia de Deploy no Vercel — KOLVOX STAGE

Este projeto está 100% preparado e configurado para deploy automático no **Vercel** com suporte a:
- **Frontend SPA**: React 19 + Vite com Tailwind CSS, roteamento client-side e caching otimizado de assets.
- **Serverless API**: Rotas `/api/*` executadas via Vercel Serverless Functions (`api/index.ts`).
- **Autenticação e Banco**: Firebase Auth + Firestore pré-configurados e banco relacional opcional via `DATABASE_URL`.

---

## 🚀 Opção 1: Deploy via GitHub (Recomendado)

1. Envie seu repositório para o **GitHub**.
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New..." > "Project"**.
3. Selecione o repositório do **KOLVOX STAGE**.
4. O Vercel detectará automaticamente as configurações definidas em `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Em **Environment Variables**, adicione as variáveis necessárias (veja abaixo).
6. Clique em **"Deploy"**.

---

## ⚡ Opção 2: Deploy via Vercel CLI

Caso utilize a linha de comando:

```bash
# 1. Instale o Vercel CLI globalmente (se ainda não tiver)
npm i -g vercel

# 2. Na raiz do projeto, execute o login e deploy:
vercel

# 3. Para subir diretamente para produção:
vercel --prod
```

---

## 🔑 Variáveis de Ambiente (Environment Variables) no Vercel

Acesse **Project Settings > Environment Variables** no painel do Vercel e adicione conforme necessário:

| Variável | Obrigatória | Descrição |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | Sim (se usar IA) | Chave de API do Google Gemini para recursos inteligentes |
| `MERCADOPAGO_ACCESS_TOKEN` | Opcional | Token de acesso de produção do Mercado Pago para cobranças Pix reais |
| `DATABASE_URL` | Opcional | URL de conexão PostgreSQL (ex: Neon, Supabase, Cloud SQL ou Vercel Postgres) |
| `GMAIL_USER` | Opcional | E-mail do Gmail para notificações automáticas do suporte |
| `GMAIL_APP_PASSWORD` | Opcional | Senha de aplicativo do Gmail para envio de e-mails |

> **Nota sobre o Firebase**: As credenciais públicas do Firebase Auth e Firestore já estão embutidas no build a partir de `firebase-applet-config.json`, funcionando imediatamente em qualquer domínio do Vercel sem necessidade de configuração adicional.

---

## 📁 Estrutura de Arquivos do Vercel no Projeto

- **`vercel.json`**: Configura o framework `vite`, comando de compilação, diretório de saída `dist`, roteamento de `/api/*` e fallback de rotas SPA para `/index.html`.
- **`api/index.ts`**: Ponto de entrada das rotas Serverless da API Express.
- **`dist/`**: Pasta de saída gerada pelo `npm run build` contendo o frontend otimizado.
