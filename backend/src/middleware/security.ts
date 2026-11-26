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
 * Default trusted origins including production Vercel and local dev environments
 */
const defaultOrigins = [
  'https://medi-find-connect.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Parses allowed CORS origins from environment variable combined with defaults
 */
const configuredOrigins = env.FRONTEND_ORIGIN
  .split(',')
  .map(normalizeOrigin)
  .filter((origin) => origin.length > 0);

export const allowedOrigins: string[] = Array.from(
  new Set([...defaultOrigins, ...configuredOrigins])
);

const corsOptions: CorsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow non-browser requests (e.g. server-to-server, curl, health checks)
    if (!requestOrigin) {
      return callback(null, true);
    }

    const cleanOrigin = normalizeOrigin(requestOrigin);

    // Exact origin match
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // Support Vercel preview deployments (e.g., medi-find-connect-*.vercel.app)
    if (/^https:\/\/medi-find-connect(-[a-zA-Z0-9-]+)?\.vercel\.app$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    // Support localhost with any port in development mode
    if (env.NODE_ENV === 'development') {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
        return callback(null, true);
      }
    }

    // Reject unauthorized origin gracefully without throwing 500 error on preflight
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  optionsSuccessStatus: 204,
  maxAge: 86400, // Cache preflight response for 24 hours
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
