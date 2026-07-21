/**
 * Auth mode selection for the admin portal.
 * - firebase: verified Firebase Auth session (users provisioned in Firebase Console).
 * - layered: IAP assertion + Firebase ID token (production design).
 * - supabase: verified Supabase Auth JWT; role from app_metadata.bb_role only.
 *
 * `ADMIN_AUTH_MODE=allowlist` is accepted as a deprecated alias for `firebase`.
 *
 * Supabase Auth cutover (ADR-020): set ADMIN_AUTH_MODE=supabase and
 * NEXT_PUBLIC_ADMIN_AUTH_MODE=supabase. Provision operators in Supabase Auth with
 * app_metadata.bb_role=admin. Supabase server env: SUPABASE_URL + SUPABASE_ANON_KEY
 * (or NEXT_PUBLIC_* equivalents).
 */

export type AdminAuthMode = 'firebase' | 'supabase' | 'layered';

type EnvironmentLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function resolveAdminAuthMode(environment: EnvironmentLike = process.env): AdminAuthMode {
  const raw = (environment.ADMIN_AUTH_MODE ?? 'firebase').trim().toLowerCase();
  if (raw === 'layered') return 'layered';
  if (raw === 'supabase') return 'supabase';
  // Legacy solo-operator env value.
  if (raw === 'allowlist' || raw === 'firebase' || raw === '') return 'firebase';
  return 'firebase';
}

/** Browser-side mode; prefers NEXT_PUBLIC_ADMIN_AUTH_MODE, then server ADMIN_AUTH_MODE at build time. */
export function resolveClientAdminAuthMode(
  environment: EnvironmentLike = process.env,
): AdminAuthMode {
  const raw = (
    environment.NEXT_PUBLIC_ADMIN_AUTH_MODE ??
    environment.ADMIN_AUTH_MODE ??
    'firebase'
  )
    .trim()
    .toLowerCase();
  if (raw === 'layered') return 'layered';
  if (raw === 'supabase') return 'supabase';
  if (raw === 'allowlist' || raw === 'firebase' || raw === '') return 'firebase';
  return 'firebase';
}
