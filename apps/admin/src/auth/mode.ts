/**
 * Auth mode selection for the admin portal.
 * - firebase: verified Firebase Auth session (users provisioned in Firebase Console).
 * - layered: IAP assertion + Firebase ID token (production design).
 *
 * `ADMIN_AUTH_MODE=allowlist` is accepted as a deprecated alias for `firebase`.
 */

export type AdminAuthMode = 'firebase' | 'layered';

export function resolveAdminAuthMode(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AdminAuthMode {
  const raw = (environment.ADMIN_AUTH_MODE ?? 'firebase').trim().toLowerCase();
  if (raw === 'layered') return 'layered';
  // Legacy solo-operator env value.
  if (raw === 'allowlist' || raw === 'firebase' || raw === '') return 'firebase';
  return 'firebase';
}
