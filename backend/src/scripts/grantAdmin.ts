import { getServiceSupabaseClient } from '../config/supabase.js';

type AdminRole = 'super_admin' | 'network_admin' | 'admin';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const roleArg = (process.argv[3]?.trim() || 'super_admin') as AdminRole;

  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx src/scripts/grantAdmin.ts <email> [super_admin|network_admin|admin]');
    process.exit(1);
  }

  if (!['super_admin', 'network_admin', 'admin'].includes(roleArg)) {
    console.error('Invalid role. Allowed: super_admin, network_admin, admin');
    process.exit(1);
  }

  const client = getServiceSupabaseClient();
  if (!client) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
    process.exit(1);
  }

  const { data: listData, error: listErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error('Failed to list Supabase users:', listErr.message);
    process.exit(1);
  }

  const user = listData.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.error(`No Supabase Auth user found with email: ${email}`);
    process.exit(1);
  }

  const { error: updateErr } = await client.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), role: roleArg },
  });
  if (updateErr) {
    console.error('Failed to update app_metadata.role:', updateErr.message);
    process.exit(1);
  }

  const { error: dbErr } = await client.from('platform_administrators').upsert(
    {
      user_id: user.id,
      role: roleArg,
      is_active: true,
      notes: `Assigned via grantAdmin CLI on ${new Date().toISOString()}`,
    },
    { onConflict: 'user_id' }
  );
  if (dbErr) {
    console.error('Failed to upsert platform_administrators:', dbErr.message);
    process.exit(1);
  }

  console.log(`Granted ${roleArg} to ${email} (user_id=${user.id}).`);
}

void main();
