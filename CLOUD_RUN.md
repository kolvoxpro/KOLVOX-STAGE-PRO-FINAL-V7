# KOLVOX STAGE — Cloud Run

This project includes a Dockerfile specifically for Cloud Run. It builds the Vite frontend and starts the Express API with `tsx server.ts`.

## Required environment variables

- `DATABASE_URL`: hosted PostgreSQL connection string
- `JWT_SECRET`: strong random secret
- `NODE_ENV=production`

Cloud Run supplies `PORT`; the server listens on `0.0.0.0` and defaults to 3000 when running outside Cloud Run.

The PostgreSQL pool is lazy: missing DATABASE_URL no longer prevents the HTTP container from starting. `/api/health` reports database status separately.

Do not put DATABASE_URL or JWT_SECRET in the repository. Configure them as Cloud Run environment variables/secrets.
