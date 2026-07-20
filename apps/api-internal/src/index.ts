/**
 * Internal publication, promotion, and control API (not internet-facing).
 * Service-identity-only auth posture.
 */
import { buildSurfaceHealth, parseNodeEnv } from '@repo/config';
import { SURFACE_ID } from './posture.js';

export { guardIncomingAuth, guardPublicationOperation, rejectEndUserToken } from './posture.js';

export function health() {
  return buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV));
}
