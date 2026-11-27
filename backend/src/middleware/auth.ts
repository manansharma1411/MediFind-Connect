import { Request, Response, NextFunction } from 'express';
import { getPublicSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
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
