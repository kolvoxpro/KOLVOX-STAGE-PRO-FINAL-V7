import type { IncomingMessage, ServerResponse } from 'node:http';
import app, { initializeBackend } from '../src/server/app.ts';

let isInitialized = false;

// Robust handler for Vercel Serverless Function invocations
export default async function handler(req: any, res: any) {
  try {
    if (!isInitialized) {
      isInitialized = true;
      initializeBackend().catch((err) => {
        console.warn('[Vercel Serverless] DB init background notification:', err);
      });
    }

    // In Vercel, when rewrites forward /api/(.*) to /api/index,
    // req.headers['x-matched-path'] or 'x-vercel-matched-path' contains the original path
    const matchedPath =
      req.headers['x-matched-path'] ||
      req.headers['x-vercel-matched-path'] ||
      req.headers['x-invoke-path'];

    if (matchedPath && typeof matchedPath === 'string' && matchedPath.startsWith('/api') && !matchedPath.startsWith('/api/index')) {
      req.url = matchedPath;
    }

    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Error]:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Erro no processamento da requisição no servidor.',
        message: err?.message || 'Server error',
      });
    }
  }
}
