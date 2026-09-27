import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';
import { createMemoryDb } from './memoryStore.ts';

dotenv.config();

// Dynamically imported PGlite references (excluded in Vercel/serverless runtimes to avoid missing WASM crashes)
let PGliteClass: any = null;
let drizzlePgliteFn: any = null;

const isServerlessRuntime =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.DENO_DEPLOYMENT_ID);

if (!isServerlessRuntime) {
  try {
    const pgliteMod = await import('@electric-sql/pglite');
    const drizzleMod = await import('drizzle-orm/pglite');
    PGliteClass = pgliteMod.PGlite;
    drizzlePgliteFn = drizzleMod.drizzle;
  } catch (e) {
    console.warn('[DB] PGlite dynamic import unavailable:', e);
  }
}

declare global {
  // deno-lint-ignore no-var
  var _postgresPool: Pool | undefined;
  // deno-lint-ignore no-var
  var _pgliteInstance: any | undefined;
  // deno-lint-ignore no-var
  var _activeEngine: 'pg' | 'pglite' | 'memory' | undefined;
}

const ALL_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  nome_artistico TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  telefone TEXT,
  cidade TEXT,
  estado TEXT,
  foto_perfil TEXT,
  tipo_usuario TEXT NOT NULL DEFAULT 'USER',
  status TEXT NOT NULL DEFAULT 'ativo',
  email_verificado BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS songs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  key TEXT,
  capo INTEGER DEFAULT 0,
  lyrics TEXT,
  chords TEXT,
  tabs TEXT,
  sheet_music TEXT,
  source_provider TEXT DEFAULT 'user_created',
  source_url TEXT,
  license_type TEXT DEFAULT 'user_owned',
  download_allowed BOOLEAN DEFAULT TRUE,
  print_allowed BOOLEAN DEFAULT TRUE,
  bpm INTEGER DEFAULT 120,
  duration TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  search_term TEXT NOT NULL,
  song_id INTEGER,
  provider TEXT DEFAULT 'internal',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS song_sources (
  id SERIAL PRIMARY KEY,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  license_type TEXT,
  copyright_status TEXT,
  display_allowed BOOLEAN DEFAULT TRUE,
  download_allowed BOOLEAN DEFAULT TRUE,
  print_allowed BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  trial_used BOOLEAN DEFAULT TRUE,
  subscription_start TIMESTAMP,
  subscription_end TIMESTAMP,
  payment_provider TEXT,
  customer_id TEXT,
  subscription_id TEXT,
  payment_id TEXT,
  amount TEXT,
  currency TEXT DEFAULT 'BRL',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subscription_id INTEGER,
  provider TEXT NOT NULL,
  external_payment_id TEXT,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL,
  reference_code TEXT,
  proof_note TEXT,
  payer_name TEXT,
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  pix_key TEXT NOT NULL DEFAULT 'kolvox.pagamentos@gmail.com',
  pix_key_type TEXT NOT NULL DEFAULT 'E-mail',
  pix_receiver_name TEXT NOT NULL DEFAULT 'KOLVOX TECNOLOGIA LTDA',
  pix_city TEXT NOT NULL DEFAULT 'SAO PAULO',
  support_email TEXT NOT NULL DEFAULT 'kolvox.pagamentos@gmail.com',
  monthly_price TEXT NOT NULL DEFAULT '9.99',
  trial_days INTEGER NOT NULL DEFAULT 7,
  pix_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  manual_payment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS gmail_integrations (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES users(id),
  google_account_email TEXT,
  google_user_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expiry TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  reply_message TEXT,
  reply_sent_at TIMESTAMP,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  ip TEXT,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
`;

function getDatabaseConfig(): PoolConfig | null {
  const databaseUrl = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL
  )?.trim();
  const isProduction =
    Boolean(process.env.DENO_DEPLOYMENT_ID) ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE);

  if (databaseUrl && !databaseUrl.includes('placeholder')) {
    return {
      connectionString: databaseUrl,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000,
    };
  }

  const host = (process.env.SQL_HOST || process.env.PGHOST)?.trim();
  const user = (process.env.SQL_USER || process.env.PGUSER)?.trim();
  const password = process.env.SQL_PASSWORD ?? process.env.PGPASSWORD ?? '';
  const database = (process.env.SQL_DB_NAME || process.env.PGDATABASE)?.trim();

  // If host is a Unix socket path that does not exist or Cloud SQL socket is inactive, ignore
  if (host && host.startsWith('/') && !fs.existsSync(host)) {
    return null;
  }

  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    user,
    password,
    database,
    port: Number(process.env.SQL_PORT || process.env.PGPORT || 5432),
    ssl: host.startsWith('/') ? undefined : (isProduction ? { rejectUnauthorized: false } : undefined),
    connectionTimeoutMillis: 5000,
  };
}

let _isPgliteFailed = false;

export function getPgliteInstance(): any | null {
  if (_isPgliteFailed || !PGliteClass) {
    return null;
  }

  if (global._pgliteInstance) {
    return global._pgliteInstance;
  }

  const isServerless =
    Boolean(process.env.DENO_DEPLOYMENT_ID) ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    // In serverless runtimes (like Vercel), PGlite WASM binaries are not present; use pure memory engine
    return null;
  }

  try {
    const dataDir = path.join(process.cwd(), 'data', 'kolvox_pg');
    fs.mkdirSync(dataDir, { recursive: true });
    global._pgliteInstance = new PGliteClass(dataDir);
    return global._pgliteInstance;
  } catch (e) {
    console.warn('[DB] Persistent PGlite initialization error, trying in-memory fallback:', e);
  }

  try {
    global._pgliteInstance = new PGliteClass();
    return global._pgliteInstance;
  } catch (err) {
    _isPgliteFailed = true;
    global._pgliteInstance = undefined;
    console.warn('[DB] PGlite in-memory is unavailable (falling back to memory engine):', err);
    return null;
  }
}

export function getPool(): Pool {
  if (!global._postgresPool) {
    const config = getDatabaseConfig();
    if (!config) {
      throw new Error('POSTGRES_NOT_CONFIGURED');
    }
    global._postgresPool = new Pool({
      ...config,
      max: 5,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: true,
    });

    global._postgresPool.on('error', (err) => {
      console.warn('[DB] PostgreSQL external pool error, falling back if needed:', err.message);
    });
  }

  return global._postgresPool;
}

export const createPool = getPool;

let _isPgConnected: boolean | null = null;
let _drizzleInstance: any = null;

export async function isPgAvailable(): Promise<boolean> {
  if (_isPgConnected !== null) return _isPgConnected;
  const config = getDatabaseConfig();
  if (!config) {
    _isPgConnected = false;
    return false;
  }
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      _isPgConnected = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('[DB] External PostgreSQL not reachable, using local database engine:', err.message || err);
    _isPgConnected = false;
    return false;
  }
}

let _memoryInstance: any = null;

export function getDrizzleInstance() {
  if (_isPgConnected === true) {
    if (!_drizzleInstance || global._activeEngine !== 'pg') {
      global._activeEngine = 'pg';
      _drizzleInstance = drizzlePg(getPool(), { schema });
    }
    return _drizzleInstance;
  }

  // If memory engine was explicitly designated or PGlite previously failed, strictly stay on in-memory store
  if (global._activeEngine === 'memory' || _isPgliteFailed) {
    global._activeEngine = 'memory';
    if (!_memoryInstance) {
      _memoryInstance = createMemoryDb();
    }
    return _memoryInstance;
  }

  // 1. Try PGlite if available in runtime and not marked failed
  try {
    const pglite = getPgliteInstance();
    if (pglite && drizzlePgliteFn) {
      if (!_drizzleInstance || global._activeEngine !== 'pglite') {
        global._activeEngine = 'pglite';
        _drizzleInstance = drizzlePgliteFn(pglite, { schema });
      }
      return _drizzleInstance;
    }
  } catch (err) {
    _isPgliteFailed = true;
    global._pgliteInstance = undefined;
    _drizzleInstance = null;
    console.warn('[DB] PGlite drizzle bridge warning, falling back to memory engine:', err);
  }

  // 2. High-resilience in-memory store (e.g. serverless Deno Deploy without external DB configured)
  global._activeEngine = 'memory';
  if (!_memoryInstance) {
    _memoryInstance = createMemoryDb();
  }
  return _memoryInstance;
}

// Lazy proxy so importing `db` never crashes at module evaluation time
export const db = new Proxy({} as any, {
  get(_target, prop, receiver) {
    const instance = getDrizzleInstance();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
}) as any;

/**
 * Creates and verifies all tables required by the application.
 */
export async function ensureAuthSchema(): Promise<void> {
  const pgOk = await isPgAvailable();
  if (pgOk) {
    try {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query(ALL_TABLES_SQL);
        return;
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn('[DB] External PostgreSQL schema error, attempting fallback:', error);
      _isPgConnected = false;
      _drizzleInstance = null;
    }
  }

  // Local PGlite execution if available
  if (!_isPgliteFailed) {
    try {
      let pglite = getPgliteInstance();
      if (pglite) {
        try {
          await pglite.waitReady;
        } catch (readyErr) {
          console.warn('[DB] Persistent PGlite failed waitReady, retrying in-memory PGlite:', readyErr);
          // If persistent files were corrupt, try a clean in-memory instance
          if (PGliteClass) {
            try {
              global._pgliteInstance = new PGliteClass();
              pglite = global._pgliteInstance;
              await pglite.waitReady;
            } catch (memErr) {
              _isPgliteFailed = true;
              global._pgliteInstance = undefined;
              _drizzleInstance = null;
              throw memErr;
            }
          }
        }

        await pglite.exec(ALL_TABLES_SQL);
        global._activeEngine = 'pglite';
        return;
      }
    } catch (err) {
      _isPgliteFailed = true;
      global._pgliteInstance = undefined;
      _drizzleInstance = null;
      console.warn('[DB] PGlite schema execution failed, operating with in-memory engine:', err);
    }
  }

  global._activeEngine = 'memory';
}

export async function checkDatabaseConnection(): Promise<void> {
  const pgOk = await isPgAvailable();
  if (pgOk) {
    return;
  }

  if (!_isPgliteFailed) {
    try {
      const pglite = getPgliteInstance();
      if (pglite) {
        await pglite.waitReady;
        await pglite.query('SELECT 1');
        global._activeEngine = 'pglite';
        return;
      }
    } catch {
      _isPgliteFailed = true;
      global._pgliteInstance = undefined;
      _drizzleInstance = null;
    }
  }

  global._activeEngine = 'memory';
}
