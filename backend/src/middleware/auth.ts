import { Request, Response, NextFunction } from 'express';
import { getPublicSupabaseClient, getServiceSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../types/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  appRole?: string | null;
}

export type AdminRoleChecker = (userId: string) => Promise<string | null>;

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

const ALLOWED_ADMIN_ROLES = new Set(['super_admin', 'network_admin', 'admin']);

export function isAdministratorUser(user: AuthenticatedUser): boolean {
  if (user.appRole && ALLOWED_ADMIN_ROLES.has(user.appRole)) {
    return true;
  }
  const adminIds = env.ADMIN_USER_IDS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminIds.includes(user.id.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Checks platform_administrators table via service_role client.
 * Never trusts frontend state, user_metadata, or email text alone.
 */
export const checkDatabaseAdminRole: AdminRoleChecker = async (userId: string) => {
  const client = getServiceSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('platform_administrators')
    .select('role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return typeof data.role === 'string' ? data.role : null;
};

export function createRequireAdmin(
  verifier: TokenVerifier = verifySupabaseToken,
  adminRoleChecker: AdminRoleChecker = checkDatabaseAdminRole
) {
  const authMiddleware = createRequireAuth(verifier);
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await authMiddleware(req, res, async (err?: unknown) => {
      if (err) {
        return next(err);
      }
      if (!req.user) {
        return next(
          new AppError(403, 'FORBIDDEN', 'Administrator privileges are required.')
        );
      }
      if (isAdministratorUser(req.user)) {
        return next();
      }
      try {
        const dbRole = await adminRoleChecker(req.user.id);
        if (dbRole && ALLOWED_ADMIN_ROLES.has(dbRole)) {
          req.user.appRole = dbRole;
          return next();
        }
      } catch {
        // Fall through to 403 FORBIDDEN
      }
      return next(
        new AppError(403, 'FORBIDDEN', 'Administrator privileges are required.')
      );
    });
  };
}

export const requireAdmin = createRequireAdmin();
