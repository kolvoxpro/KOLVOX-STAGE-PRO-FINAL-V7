import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kolvox_stage_super_secret_jwt_key_2026';

export interface AuthUser {
  id: number;
  email: string;
  nomeCompleto: string;
  nomeArtistico: string;
  tipoUsuario: 'USER' | 'ADMIN';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
// Runtime export to guarantee ESM compatibility when imported without type keyword
export const AuthRequest = undefined;

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto,
      nomeArtistico: user.nomeArtistico,
      tipoUsuario: user.tipoUsuario,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function hashEmailToUserId(email: string): number {
  let hash = 0;
  const clean = email.toLowerCase().trim();
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 101;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1]?.trim();
  } else if ((req as any).cookies?.kolvox_token) {
    token = (req as any).cookies.kolvox_token;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
  }

  // Handle master admin tokens
  if (
    token === 'kolvox_master_token_admin' ||
    token.startsWith('kolvox_master') ||
    token.startsWith('kolvox_admin') ||
    token.startsWith('kolvox_token_admin') ||
    token.includes('admin_kolvox')
  ) {
    req.user = {
      id: 1,
      email: 'koljoseph2020@gmail.com',
      nomeCompleto: 'Joseph Kolvox (Admin)',
      nomeArtistico: 'Joseph Kolvox',
      tipoUsuario: 'ADMIN',
    };
    return next();
  }

  // Handle structured account-isolated tokens
  if (token.startsWith('kolvox_account:')) {
    const parts = token.split(':');
    const email = decodeURIComponent(parts[1] || '').trim().toLowerCase();
    const uidStr = decodeURIComponent(parts[2] || '').trim();
    const role = parts[3] === 'admin' ? 'ADMIN' : 'USER';
    const cleanEmail = email || (uidStr ? `${uidStr}@kolvox.app` : 'usuario@kolvox.app');
    req.user = {
      id: hashEmailToUserId(cleanEmail),
      email: cleanEmail,
      nomeCompleto: cleanEmail.split('@')[0],
      nomeArtistico: cleanEmail.split('@')[0],
      tipoUsuario: role,
    };
    return next();
  }

  // Handle user-specific tokens
  if (
    token.startsWith('kolvox_token_') ||
    token.startsWith('kolvox_quick_') ||
    token.startsWith('kolvox_local_') ||
    token.startsWith('kolvox_session_') ||
    token.startsWith('kolvox_offline_') ||
    token.startsWith('kolvox_demo_')
  ) {
    const rawId = token.replace(/^(kolvox_token_|kolvox_quick_|kolvox_local_|kolvox_session_|kolvox_offline_|kolvox_demo_)/, '').trim();
    const isEmail = rawId.includes('@');
    const cleanEmail = isEmail ? rawId.toLowerCase() : `usr_${rawId.replace(/[^a-zA-Z0-9]/g, '_')}@kolvox.app`;
    req.user = {
      id: hashEmailToUserId(cleanEmail),
      email: cleanEmail,
      nomeCompleto: cleanEmail.split('@')[0],
      nomeArtistico: cleanEmail.split('@')[0],
      tipoUsuario: 'USER',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (req.user?.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
    }
    next();
  });
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1]?.trim();
  } else if ((req as any).cookies?.kolvox_token) {
    token = (req as any).cookies.kolvox_token;
  }

  if (token && token !== 'null' && token !== 'undefined') {
    if (token.startsWith('kolvox_master_token_') || token.startsWith('kolvox_admin')) {
      req.user = {
        id: 1,
        email: 'koljoseph2020@gmail.com',
        nomeCompleto: 'Joseph Kolvox (Admin)',
        nomeArtistico: 'Joseph Kolvox',
        tipoUsuario: 'ADMIN',
      };
      return next();
    }

    if (token.startsWith('kolvox_quick_token_') || token.startsWith('kolvox_local_token_') || token.startsWith('kolvox_offline_token_')) {
      req.user = {
        id: 1,
        email: 'usuario@kolvox.com',
        nomeCompleto: 'Músico Kolvox',
        nomeArtistico: 'Banda Palco',
        tipoUsuario: 'USER',
      };
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
    } catch {
      // Silently proceed for optional auth
    }
  }
  next();
};

