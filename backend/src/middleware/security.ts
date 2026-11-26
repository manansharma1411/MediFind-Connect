import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * Normalizes an origin string by trimming whitespace and trailing slashes.
 */
function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Parses allowed CORS origins from comma-separated environment variable.
 * Includes local development defaults alongside production origins.
 */
export const allowedOrigins: string[] = env.FRONTEND_ORIGIN
  .split(',')
  .map(normalizeOrigin)
  .filter((origin) => origin.length > 0);

const corsOptions: CorsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow server-to-server, curl, or mobile app requests without Origin header
    if (!requestOrigin) {
      return callback(null, true);
    }

    const cleanOrigin = normalizeOrigin(requestOrigin);

    // In production, reject any wildcards when credentials mode is enabled
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // In development mode, allow localhost origins by default if not explicitly listed
    if (env.NODE_ENV === 'development') {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    // Reject unauthorized origin without throwing 500 error on preflight
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

export const corsMiddleware: RequestHandler = cors(corsOptions);
