import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let publicClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Returns public Supabase client (using anon/publishable key).
 * Returns null if credentials are not configured yet.
 */
export function getPublicSupabaseClient(): SupabaseClient | null {
  if (publicClient) return publicClient;

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    logger.warn('Supabase URL or Anon Key is missing. Client library operations unavailable.');
    return null;
  }

  publicClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  return publicClient;
}

/**
 * Returns administrative service-role Supabase client.
 * NEVER expose this instance to frontend consumers.
 */
export function getServiceSupabaseClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('Supabase URL or Service Role Key is missing. Administrative operations unavailable.');
    return null;
  }

  serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}
