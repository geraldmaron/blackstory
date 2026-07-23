/**
 * Runtime wiring that binds the security primitives to the real Expo config
 * (MOB-010). Kept separate from the pure/testable modules so those stay free
 * of `expo-constants` globals.
 */
import Constants from 'expo-constants';

import { createApiClient, type ApiClient } from './api-client';

/** The `/vN` major this build targets. Bump alongside the wire contract. */
const API_MAJOR = 1;

/** Production default baked into `app.config.ts` when `API_BASE_URL` is unset. */
export const DEFAULT_API_BASE_URL = 'https://api.blackbook.app';

/**
 * Resolve the public API origin this build will call (`apps/api-public`).
 * Same precedence as `createDefaultApiClient`: explicit override →
 * `extra.apiBaseUrl` from app.config → production default.
 */
export function resolveApiBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ??
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    DEFAULT_API_BASE_URL
  );
}

/**
 * Build the client-attesting API client against `apps/api-public`. The base
 * URL is read from `extra.apiBaseUrl` (set per-variant once real hosts exist;
 * MOB-009 owns the typed client on top of this).
 */
export function createDefaultApiClient(baseUrl?: string): ApiClient {
  const resolvedBase = resolveApiBaseUrl(baseUrl);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // Loud on purpose: Dev pointing at an unreachable host (e.g. NXDOMAIN
    // api.blackbook.app before DNS/deploy) looks like "no Supabase data".
    console.info(`[blackstory] apiBaseUrl=${resolvedBase}`);
  }
  return createApiClient({
    baseUrl: resolvedBase,
    clientVersion: Constants.expoConfig?.version ?? '0.0.0',
    apiMajor: API_MAJOR,
  });
}
