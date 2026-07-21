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

import { getAppRuntime, type AppRuntime } from './create-app-runtime';

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
        await initializeObservability(next.store, next.connectivity);
        await next.bootstrapSync.sync();
        if (!cancelled) setRuntime(next);
      } catch {
        // Degrade: keep rendering children without providers rather than crash the shell.
        if (!cancelled) setRuntime(null);
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
