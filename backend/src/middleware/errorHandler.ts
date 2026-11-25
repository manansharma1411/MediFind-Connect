import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled request exception', err);

  // Handle known application domain errors
  if (err instanceof AppError) {
    const body: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      timestamp: new Date().toISOString(),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    const body: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      timestamp: new Date().toISOString(),
    };
    res.status(400).json(body);
    return;
  }

  // Internal unhandled server error — strictly protect internal stack traces in production
  const body: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected internal server error occurred.'
          : err.message,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiResponse = {
    success: false,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(404).json(body);
}
