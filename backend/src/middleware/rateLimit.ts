import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/index.js';

interface WindowBucket {
  count: number;
  resetAtMs: number;
}

/**
 * Lightweight in-memory sliding-window rate limiter.
 * Uses user ID when authenticated, or a transient non-persisted socket key
 * purely in RAM for abuse protection (never stored in database).
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keySelector?: (req: Request) => string;
}) {
  const buckets = new Map<string, WindowBucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const rawKey = options.keySelector
      ? options.keySelector(req)
      : req.user?.id || req.ip || 'anonymous';
    const key = `${options.keyPrefix}:${rawKey}`;

    const existing = buckets.get(key);
    if (!existing || existing.resetAtMs <= now) {
      buckets.set(key, { count: 1, resetAtMs: now + options.windowMs });
      return next();
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Please retry after ${retryAfterSec} seconds.`
        )
      );
    }

    existing.count += 1;
    next();
  };
}
