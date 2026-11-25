import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * Parses allowed CORS origins from comma-separated environment variable
 */
const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map((o) => o.trim());

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server-to-server or curl) in development
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not permitted by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
