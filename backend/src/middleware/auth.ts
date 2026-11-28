import { Request, Response, NextFunction } from 'express';
import { getPublicSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../types/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  appRole?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export type TokenVerifier = (token: string) => Promise<AuthenticatedUser | null>;

/**
 * Default token verifier backed by Supabase Auth (verifies JWT signature & session remotely).
 */
export const verifySupabaseToken: TokenVerifier = async (token: string) => {
  const supabase = getPublicSupabaseClient();
  if (!supabase) {
    throw new AppError(
      503,
      'AUTH_UNAVAILABLE',
      'Supabase Auth is not configured on this server.'
    );
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    appRole:
      typeof data.user.app_metadata?.role === 'string'
        ? data.user.app_metadata.role
        : null,
  };
};

/**
 * Creates authentication middleware requiring a valid Bearer JWT.
 */
export function createRequireAuth(verifier: TokenVerifier = verifySupabaseToken) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(
          new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization Bearer token.')
        );
      }

      const token = authHeader.slice('Bearer '.length).trim();
      if (!token) {
        return next(
          new AppError(401, 'UNAUTHORIZED', 'Empty Authorization Bearer token.')
        );
      }

      const user = await verifier(token);
      if (!user) {
        return next(
          new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token.')
        );
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAuth = createRequireAuth();

export function isAdministratorUser(user: AuthenticatedUser): boolean {
  if (user.appRole === 'network_admin' || user.appRole === 'admin') {
    return true;
  }
  const adminIds = env.ADMIN_USER_IDS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminIds.includes(user.id.toLowerCase())) {
    return true;
  }
  const adminEmails = env.ADMIN_EMAILS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && adminEmails.includes(user.email.toLowerCase())) {
    return true;
  }
  return false;
}

export function createRequireAdmin(verifier: TokenVerifier = verifySupabaseToken) {
  const authMiddleware = createRequireAuth(verifier);
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await authMiddleware(req, res, (err?: unknown) => {
      if (err) {
        return next(err);
      }
      if (!req.user || !isAdministratorUser(req.user)) {
        return next(
          new AppError(403, 'FORBIDDEN', 'Administrator privileges are required.')
        );
      }
      next();
    });
  };
}

export const requireAdmin = createRequireAdmin();
