/**
 * Runtime wiring that binds the security primitives to the real Expo config
 * (MOB-010). Kept separate from the pure/testable modules so those stay free
 * of `expo-constants` globals.
 */
import Constants from 'expo-constants';

import { createApiClient, type ApiClient } from './api-client';

/** The `/vN` major this build targets. Bump alongside the wire contract. */
const API_MAJOR = 1;

/**
 * Build the client-attesting API client against `apps/api-public`. The base
 * URL is read from `extra.apiBaseUrl` (set per-variant once real hosts exist;
 * MOB-009 owns the typed client on top of this).
 */
export function createDefaultApiClient(baseUrl?: string): ApiClient {
  const resolvedBase =
    baseUrl ??
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    'https://api.blackbook.app';
  return createApiClient({
    baseUrl: resolvedBase,
    clientVersion: Constants.expoConfig?.version ?? '0.0.0',
    apiMajor: API_MAJOR,
  });
}
