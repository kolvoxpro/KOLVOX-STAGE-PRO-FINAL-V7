import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import app, { initializeBackend } from './src/server/app.ts';

async function startServer() {
  // Load .env before importing modules that access the database.
  dotenv.config();

  const PORT = Number(process.env.PORT || '3000');

  // Initialize DB and schemas in the background
  try {
    await initializeBackend();
  } catch (err) {
    console.warn('Database initialization warning (server will still listen):', err);
  }

  // Vite middleware for local development; Deno Deploy and production always serve the built SPA.
  const isDeploy = Boolean(process.env.DENO_DEPLOYMENT_ID);
  const isProduction = process.env.NODE_ENV === 'production' || isDeploy;
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const serverDir = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.join(serverDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Frontend build not found at ${indexPath}. Ensure build command ran: npm run build.`, err);
          if (!res.headersSent) {
            res.status(503).json({
              error: 'Frontend build unavailable',
              message: 'O build do frontend não foi encontrado. Execute: npm run build.'
            });
          }
        }
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KOLVOX STAGE server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KOLVOX STAGE server:', err);
});
