# KOLVOX STAGE — Deno Deploy

## Obrigatório

Defina no Deno Deploy:

- Runtime: Dynamic
- Entrypoint: `server.ts`
- Install command: `npm install`
- Build command: `npm run build`
- App/working directory: `.`

## Banco de dados

O servidor usa `DATABASE_URL` primeiro. Configure uma URL PostgreSQL real no ambiente de produção, por exemplo:

`postgresql://USUARIO:SENHA@HOST:5432/BANCO?sslmode=require`

Não use `localhost` no Deno Deploy.

Também podem ser usados, como fallback legado, `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD` e `SQL_DB_NAME`.

## Diagnóstico

Abra `/api/health`. O resultado esperado contém:

`"status":"ok"`

`"database":"connected"`

Se retornar `503`, o servidor está ativo, mas o PostgreSQL não está conectado ou as tabelas ainda não foram criadas.

## Schema

Antes do primeiro uso, aplique o schema Drizzle no PostgreSQL com `npm run db:push` em um ambiente autorizado a acessar o mesmo banco, ou use o fluxo de migrations da sua infraestrutura.
