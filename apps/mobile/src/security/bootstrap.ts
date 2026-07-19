/**
 * Runtime wiring that binds the security primitives to the real Expo config
 * (MOB-010). Kept separate from the pure/testable modules so those stay free
 * of `expo-constants` / `__DEV__` globals.
 */
import Constants from 'expo-constants';

import {
  getAppCheckToken,
  initializeAppCheckClient,
  type AppCheckInitResult,
  type AppVariant,
} from './app-check';
import { createApiClient, type ApiClient } from './api-client';
import {
  resolveEnforcementMode,
  type AppCheckEnforcementMode,
} from './enforcement';

/** The `/vN` major this build targets. Bump alongside the wire contract. */
const API_MAJOR = 1;

function currentVariant(): AppVariant {
  const variant = Constants.expoConfig?.extra?.appVariant;
  if (variant === 'production' || variant === 'preview') {
    return variant;
  }
  return 'development';
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

/** Resolve the (client-advisory) App Check enforcement stage from config. */
export function currentEnforcementMode(): AppCheckEnforcementMode {
  return resolveEnforcementMode(
    Constants.expoConfig?.extra?.appCheckEnforcementMode,
  );
}

/**
 * Initialize App Check for this build. Never throws — see
 * initializeAppCheckClient. Call once on app start (from a real entry point;
 * MOB-008 owns the route tree and is not touched here).
 */
export function bootstrapAppCheck(): Promise<AppCheckInitResult> {
  return initializeAppCheckClient({
    variant: currentVariant(),
    isDev: isDevBuild(),
  });
}

/**
 * Build the App Check-attaching API client against `apps/api-public`. The
 * base URL is read from `extra.apiBaseUrl` (set per-variant once real hosts
 * exist; MOB-009 owns the typed client on top of this).
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
    getToken: (forceRefresh) => getAppCheckToken(forceRefresh),
  });
}
