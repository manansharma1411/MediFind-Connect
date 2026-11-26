import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { getServiceSupabaseClient } from '../config/supabase.js';
import { ApiResponse, HealthCheckResponse, ReadinessCheckResponse } from '../types/index.js';

/**
 * GET /api/health and GET /health
 * Public health check: confirms API process is running cleanly without exposing secrets.
 * Provides both root status (for frontend health badge) and structured data envelope.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const payload: HealthCheckResponse = {
    status: 'ok',
    message: 'MediFind Connect API is running',
    app: 'MediFind Connect API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json({
    status: 'ok',
    success: true,
    service: 'backend',
    message: 'MediFind Connect API is running',
    data: payload,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/readiness and GET /readiness
 * Database readiness check: distinguishes API health from database connectivity.
 */
export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    const payload: ReadinessCheckResponse = {
      status: 'degraded',
      database: {
        configured: false,
        connected: false,
        message: 'Supabase credentials are not configured in local environment.',
      },
      timestamp: new Date().toISOString(),
    };

    const response: ApiResponse<ReadinessCheckResponse> = {
      status: 'degraded',
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
    return;
  }

  const startTime = Date.now();
  try {
    const { error } = await supabase.from('medicines').select('count', { count: 'exact', head: true });
    const latencyMs = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') {
      const payload: ReadinessCheckResponse = {
        status: 'degraded',
        database: {
          configured: true,
          connected: false,
          latencyMs,
          message: `Database ping returned error: ${error.message}`,
        },
        timestamp: new Date().toISOString(),
      };
      res.status(200).json({
        status: 'degraded',
        success: true,
        data: payload,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const payload: ReadinessCheckResponse = {
      status: 'ready',
      database: {
        configured: true,
        connected: true,
        latencyMs,
        message: 'Supabase PostgreSQL connection verified.',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      status: 'ready',
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    const payload: ReadinessCheckResponse = {
      status: 'degraded',
      database: {
        configured: true,
        connected: false,
        latencyMs,
        message: `Database connection failed: ${errorMessage}`,
      },
      timestamp: new Date().toISOString(),
    };
    res.status(200).json({
      status: 'degraded',
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  }
}
