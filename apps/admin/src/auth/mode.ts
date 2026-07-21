/** Supabase is the sole supported admin authentication mode. */
export type AdminAuthMode = 'supabase';

type EnvironmentLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

function assertSupabaseMode(value: string | undefined, key: string): void {
  const mode = value?.trim().toLowerCase();
  if (mode && mode !== 'supabase') {
    throw new Error(`${key}=${mode} is unsupported; Supabase Auth is required`);
  }
}

export function resolveAdminAuthMode(environment: EnvironmentLike = process.env): AdminAuthMode {
  assertSupabaseMode(environment.ADMIN_AUTH_MODE, 'ADMIN_AUTH_MODE');
  return 'supabase';
}

export function resolveClientAdminAuthMode(
  environment: EnvironmentLike = process.env,
): AdminAuthMode {
  assertSupabaseMode(
    environment.NEXT_PUBLIC_ADMIN_AUTH_MODE ?? environment.ADMIN_AUTH_MODE,
    'NEXT_PUBLIC_ADMIN_AUTH_MODE',
  );
  return 'supabase';
}
