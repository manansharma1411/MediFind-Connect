import { getServiceSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';

export interface IAuthAdminService {
  createOwnerAccount(params: {
    email: string;
    password: string;
  }): Promise<{ userId: string }>;
  deleteOwnerAccount(userId: string): Promise<void>;
}

export class SupabaseAuthAdminService implements IAuthAdminService {
  async createOwnerAccount(params: {
    email: string;
    password: string;
  }): Promise<{ userId: string }> {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new AppError(
        503,
        'AUTH_UNAVAILABLE',
        'Supabase Auth admin service is not configured.'
      );
    }

    const { data, error } = await client.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { role: 'pharmacy_owner' },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        error.status === 422
      ) {
        throw new AppError(
          409,
          'CONFLICT',
          'An account with this email is already registered.'
        );
      }
      throw new AppError(
        502,
        'AUTH_CREATION_FAILED',
        `Unable to create manager account: ${error.message}`
      );
    }

    if (!data?.user?.id) {
      throw new AppError(
        502,
        'AUTH_CREATION_FAILED',
        'Manager account creation did not return a valid user ID.'
      );
    }

    return { userId: data.user.id };
  }

  async deleteOwnerAccount(userId: string): Promise<void> {
    const client = getServiceSupabaseClient();
    if (!client) return;
    await client.auth.admin.deleteUser(userId);
  }
}

export const supabaseAuthAdminService = new SupabaseAuthAdminService();
