import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/auth.ts';
import songsRoutes from './routes/songs.ts';
import playlistsRoutes from './routes/playlists.ts';
import subscriptionsRoutes from './routes/subscriptions.ts';
import adminRoutes from './routes/admin.ts';
import settingsRoutes from './routes/settings.ts';
import supportRoutes from './routes/support.ts';
import paymentsRoutes from './routes/payments.ts';
import favoritesRoutes from './routes/favorites.ts';
import { checkDatabaseConnection, ensureAuthSchema } from '../db/index.ts';
import { seedDatabase } from './seed.ts';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global CORS & pre-flight handling
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Lazy background database check & seed guard for serverless/cold starts
let isDbInitStarted = false;
export async function initializeBackend() {
  if (isDbInitStarted) return;
  isDbInitStarted = true;
  try {
    await ensureAuthSchema();
    await checkDatabaseConnection();
    await seedDatabase();
    console.log('[KOLVOX] Database schemas and seed data ready.');
  } catch (err) {
    console.warn('[KOLVOX] Database initialization warning (resilient fallback active):', err);
  }
}

// Middleware to ensure DB init on first request
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  if (!isDbInitStarted) {
    // Non-blocking initialization
    initializeBackend().catch(() => {});
  }
  next();
});

// Health check endpoint (both /api/health and /health)
app.get(['/api/health', '/health'], async (_req: Request, res: Response) => {
  try {
    await checkDatabaseConnection();
    res.json({
      status: 'ok',
      database: 'connected',
      service: 'KOLVOX STAGE API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(200).json({
      status: 'degraded',
      database: 'disconnected',
      service: 'KOLVOX STAGE API',
      message: 'Servidor operacional. Conexão com banco pendente de configuração do DATABASE_URL.',
      details: error?.message || String(error),
    });
  }
});

// Register all API routes under both /api/* and direct routes (for Vercel rewrites or standalone mounts)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/songs', '/songs'], songsRoutes);
app.use(['/api/playlists', '/playlists'], playlistsRoutes);
app.use(['/api/subscriptions', '/subscriptions'], subscriptionsRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);
app.use(['/api/settings', '/settings'], settingsRoutes);
app.use(['/api/support', '/support'], supportRoutes);
app.use(['/api/payments', '/payments'], paymentsRoutes);
app.use(['/api/favorites', '/favorites'], favoritesRoutes);

// Return JSON 404 for unmatched /api/* requests so client never receives HTML error pages
app.all(['/api/*', '/auth/*', '/songs/*', '/playlists/*', '/support/*', '/admin/*', '/settings/*'], (req: Request, res: Response) => {
  res.status(404).json({
    error: `Rota API ${req.method} ${req.path} não encontrada.`,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Global JSON error handler so client never receives an HTML "A server error occurred" page
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[API Server Error]:', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor. Tente novamente em instantes.',
    timestamp: new Date().toISOString(),
  });
});

export default app;
