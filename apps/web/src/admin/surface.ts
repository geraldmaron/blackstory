/**
 * Admin console surface identity. `/admin` is a staff-gated route group inside this same
 * apps/web Next.js app (not a separate deployable); the distinction that still matters is
 * credential scope, not process — see `lib/canonical-postgres-client.ts` and
 * `canonical-write-boundary.test.ts`.
 */
import {
  buildSurfaceHealth,
  getSurfaceDefinition,
  parseNodeEnv,
  type AuthMode,
} from '@repo/config';

export const SURFACE_ID = 'admin' as const;

export function adminSurfaceDefinition() {
  return getSurfaceDefinition(SURFACE_ID);
}

export function health() {
  return buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV));
}

export function guardAdminAuth(authMode: AuthMode): void {
  if (authMode === 'anonymous') {
    throw new Error('admin requires IAP session and app authorization');
  }
}
