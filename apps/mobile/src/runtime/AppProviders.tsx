/**
 * React providers that bind the shared app runtime into the tree (repo-8b5h).
 *
 * On mount: observability bootstrap, one QueryClient with SQLite
 * persistence, and a single bootstrap-sync against `/v1/bootstrap`. Features
 * read transport/cache/connectivity from AppRuntimeContext.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { createMobileQueryClient, mobileDehydrateOptions } from '@/data';
import type { SyncResult } from '@/data';
import { initializeObservability } from '@/observability';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '@/security';

import { getAppRuntime, type AppRuntime } from './create-app-runtime';

function logDev(message: string, detail?: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  if (detail === undefined) {
    console.info(`[blackstory] ${message}`);
    return;
  }
  console.info(`[blackstory] ${message}`, detail);
}

function usesLocalDevApi(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return resolveApiBaseUrl() !== DEFAULT_API_BASE_URL;
}

async function refreshBootstrapSync(
  runtime: AppRuntime,
  apply: (syncResult: SyncResult) => void,
): Promise<void> {
  try {
    const syncResult = await runtime.bootstrapSync.sync();
    apply(syncResult);
    if (syncResult.status !== 'offline') {
      logDev(`apiBaseUrl=${resolveApiBaseUrl()}`, { bootstrapSync: syncResult });
    }
  } catch {
    // Keep the prior sync outcome; map/search may still reach a late-started API.
  }
}

const AppRuntimeContext = createContext<AppRuntime | null>(null);
const BootstrapRefreshContext = createContext<(() => void) | null>(null);

/** Re-run `/v1/bootstrap` sync — e.g. after a successful live map fetch clears stale offline state. */
export function useRefreshBootstrapSync(): () => void {
  const refresh = useContext(BootstrapRefreshContext);
  return refresh ?? (() => {});
}

/** Synchronous client so screens never mount outside QueryClientProvider during runtime warm-up. */
const bootstrapQueryClient = createMobileQueryClient();

export function useAppRuntime(): AppRuntime {
  const runtime = useContext(AppRuntimeContext);
  if (!runtime) {
    throw new Error('useAppRuntime requires AppProviders');
  }
  return runtime;
}

/** Optional access for screens that may render before providers finish warming. */
export function useAppRuntimeOptional(): AppRuntime | null {
  return useContext(AppRuntimeContext);
}

export interface AppProvidersProps {
  readonly children: ReactNode;
  /** Test injection — skips getAppRuntime() when provided. */
  readonly runtime?: AppRuntime;
}

export function AppProviders({ children, runtime: injected }: AppProvidersProps) {
  const [loadedRuntime, setLoadedRuntime] = useState<AppRuntime | null>(null);
  const runtime = injected ?? loadedRuntime;

  const applyBootstrapSync = useCallback((syncResult: SyncResult) => {
    setLoadedRuntime((prev) => (prev ? { ...prev, lastBootstrapSync: syncResult } : prev));
  }, []);

  const refreshBootstrapSyncNow = useCallback(() => {
    if (!runtime) return;
    void refreshBootstrapSync(runtime, applyBootstrapSync);
  }, [runtime, applyBootstrapSync]);

  useEffect(() => {
    if (injected) {
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryInterval: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      try {
        const next = await getAppRuntime();
        try {
          await initializeObservability(next.store, next.connectivity);
        } catch (obsErr) {
          console.warn('[blackstory] observability init failed (non-fatal)', obsErr);
        }

        let syncResult = next.lastBootstrapSync;
        try {
          syncResult = await next.bootstrapSync.sync();
        } catch {
          syncResult = { status: 'offline', stamp: undefined };
        }

        const runtimeWithSync = { ...next, lastBootstrapSync: syncResult };
        logDev(`apiBaseUrl=${resolveApiBaseUrl()}`, { bootstrapSync: syncResult });

        if (syncResult.status === 'offline') {
          console.warn(
            `[blackstory] bootstrapSync offline (could not reach ${resolveApiBaseUrl()}/v1/bootstrap). ` +
              (usesLocalDevApi()
                ? 'Start api-public on that host, then reload or return to the app. Local dev will not substitute demo fixtures.'
                : 'Explore will try GET /v1/map and fall back to demo fixtures in __DEV__ if unreachable. ' +
                  'For local Supabase reads: run apps/api-public with PUBLIC_DATA_SOURCE=postgres + DATABASE_URL, ' +
                  'set apps/mobile/.env.local API_BASE_URL to your LAN http://IP:8080, then restart Metro.'),
          );
        }
        if (!cancelled) setLoadedRuntime(runtimeWithSync);

        if (!cancelled && syncResult.status === 'offline' && usesLocalDevApi()) {
          // api-public is often started after Metro; poll bootstrap so the banner
          // clears without requiring an app restart when the local API comes up.
          const scheduleRetry = () => {
            if (cancelled) return;
            void refreshBootstrapSync(runtimeWithSync, (retryResult) => {
              if (cancelled) return;
              setLoadedRuntime((prev) =>
                prev ? { ...prev, lastBootstrapSync: retryResult } : prev,
              );
              if (retryResult.status !== 'offline' && retryInterval) {
                clearInterval(retryInterval);
                retryInterval = undefined;
              }
            });
          };
          retryTimer = setTimeout(scheduleRetry, 3_000);
          retryInterval = setInterval(scheduleRetry, 10_000);
        }
      } catch (err) {
        console.warn('[blackstory] AppProviders init failed; attempting degraded runtime', err);
        try {
          const fallback = await getAppRuntime();
          if (!cancelled) {
            setLoadedRuntime({ ...fallback, lastBootstrapSync: { status: 'offline', stamp: undefined } });
          }
        } catch (fallbackErr) {
          console.warn('[blackstory] runtime unavailable; features run without shared providers', fallbackErr);
          if (!cancelled) setLoadedRuntime(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [injected]);

  useEffect(() => {
    if (!runtime || injected) return;

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      void refreshBootstrapSync(runtime, applyBootstrapSync);
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [runtime, injected, applyBootstrapSync]);

  if (!runtime) {
    return <QueryClientProvider client={bootstrapQueryClient}>{children}</QueryClientProvider>;
  }

  return (
    <AppRuntimeContext.Provider value={runtime}>
      <BootstrapRefreshContext.Provider value={refreshBootstrapSyncNow}>
      <PersistQueryClientProvider
        client={runtime.queryClient}
        persistOptions={{
          persister: runtime.persister,
          dehydrateOptions: mobileDehydrateOptions,
        }}
      >
        {children}
      </PersistQueryClientProvider>
      </BootstrapRefreshContext.Provider>
    </AppRuntimeContext.Provider>
  );
}