/**
 * Admin console surface contract separate deployable from apps/web (ADR-005).
 */
import {
  buildSurfaceHealth,
  getSurfaceDefinition,
  parseNodeEnv,
  type AuthMode,
} from '@blap/config';

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
