import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load local environment file if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DEMAND_MIN_THRESHOLD: z.coerce.number().int().min(3).max(100).default(5),
  DEMAND_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(90),
  DEMAND_DEDUP_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  DEMAND_SIGNAL_SALT: z.string().min(8).default('medifind-demand-salt-v1'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((e) => `[${e.path.join('.')}]: ${e.message}`)
      .join(', ');
    throw new Error(`Environment validation failed: ${errorDetails}`);
  }
  return result.data;
}

export const env = parseEnv();
