/**
 * React providers that bind the shared app runtime into the tree (repo-8b5h).
 *
 * On mount: observability bootstrap, one QueryClient with SQLite
 * persistence, and a single bootstrap-sync against `/v1/bootstrap`. Features
 * read transport/cache/connectivity from AppRuntimeContext.
 */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { mobileDehydrateOptions } from '@/data';
import { initializeObservability } from '@/observability';
import { resolveApiBaseUrl } from '@/security';

import { getAppRuntime, type AppRuntime } from './create-app-runtime';

function logDev(message: string, detail?: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  if (detail === undefined) {
    console.info(`[blackstory] ${message}`);
    return;
  }
  console.info(`[blackstory] ${message}`, detail);
}

const AppRuntimeContext = createContext<AppRuntime | null>(null);

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
  const [runtime, setRuntime] = useState<AppRuntime | null>(injected ?? null);

  useEffect(() => {
    if (injected) {
      setRuntime(injected);
      return;
    }
    let cancelled = false;
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
              'Explore map uses demo fixtures until a live map GeoJSON endpoint is wired. ' +
              'For local Supabase reads: run apps/api-public with PUBLIC_DATA_SOURCE=postgres + DATABASE_URL, ' +
              'set apps/mobile/.env.local API_BASE_URL to your LAN http://IP:8080, then restart Metro.',
          );
        }
        if (!cancelled) setRuntime(runtimeWithSync);
      } catch (err) {
        console.warn('[blackstory] AppProviders init failed; attempting degraded runtime', err);
        try {
          const fallback = await getAppRuntime();
          if (!cancelled) {
            setRuntime({ ...fallback, lastBootstrapSync: { status: 'offline', stamp: undefined } });
          }
        } catch (fallbackErr) {
          console.warn('[blackstory] runtime unavailable; features run without shared providers', fallbackErr);
          if (!cancelled) setRuntime(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [injected]);

  if (!runtime) {
    return <>{children}</>;
  }

  return (
    <AppRuntimeContext.Provider value={runtime}>
      <PersistQueryClientProvider
        client={runtime.queryClient}
        persistOptions={{
          persister: runtime.persister,
          dehydrateOptions: mobileDehydrateOptions,
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </AppRuntimeContext.Provider>
  );
}
