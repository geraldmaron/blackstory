/**
 * Runtime wiring for the corrections client (MOB-016). Kept separate from the
 * pure/testable modules so those stay free of `expo-constants` and native
 * module loads — the same split bootstrap.ts uses for the security layer.
 *
 * Binds:
 *   - the submissions-surface base URL (ADR-021 §3; falls back to the api-public
 *     base until a distinct submissions host is configured),
 *   - the App Check token provider (`getAppCheckToken`),
 *   - the SecureStore-backed receipt store (lazy native backend),
 *   - NetInfo-backed connectivity (lazy native).
 *
 * Nothing here is imported by tests; the client is exercised with injected fakes.
 */
import Constants from 'expo-constants';

import { getAppCheckToken } from '@/security/app-check';
import { createSecretStore, type SecretStore } from '@/data/secure-store';
import { createNetInfoConnectivity } from '@/data/offline';
import { CORRECTIONS_API_MAJOR } from './contract';
import { type CorrectionClientDeps } from './client';

function resolveSubmissionsBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return (
    (extra?.submissionsBaseUrl as string | undefined) ??
    (extra?.apiBaseUrl as string | undefined) ??
    'https://api.blackbook.app'
  );
}

/**
 * Build the corrections client dependencies against the real Expo config and
 * native modules. Awaits the SecureStore + connectivity native backends.
 */
export async function createCorrectionClientDeps(): Promise<CorrectionClientDeps> {
  const { createExpoSecretBackend } = await import('@/data/secure-store');
  const secrets: SecretStore = createSecretStore(await createExpoSecretBackend());
  const connectivity = await createNetInfoConnectivity();
  return {
    baseUrl: resolveSubmissionsBaseUrl(),
    clientVersion: Constants.expoConfig?.version ?? '0.0.0',
    apiMajor: CORRECTIONS_API_MAJOR,
    getToken: (forceRefresh) => getAppCheckToken(forceRefresh),
    fetch: globalThis.fetch,
    secrets,
    connectivity,
  };
}
