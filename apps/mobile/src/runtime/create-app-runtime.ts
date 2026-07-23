/**
 * Shared app runtime composition (repo-8b5h).
 *
 * Owns the single SQLite cache open, typed transport, release cache,
 * bootstrap synchronizer, TanStack Query client + SQLite persister, and
 * connectivity signal. Feature modules consume this via AppRuntimeProvider
 * instead of constructing independent singletons.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import {
  createBootstrapSynchronizer,
  createMobileQueryClient,
  createNetInfoConnectivity,
  createReleaseCache,
  createRuntimeCache,
  createSqlitePersister,
  createSupersedingRunner,
  createTransport,
  type SyncResult,
  type BootstrapSynchronizer,
  type CacheStore,
  type Connectivity,
  type ReleaseCache,
  type Transport,
} from '@/data';
import { createDefaultApiClient } from '@/security';

export interface AppRuntime {
  readonly store: CacheStore;
  readonly queryClient: QueryClient;
  readonly persister: Persister;
  readonly transport: Transport;
  readonly releaseCache: ReleaseCache;
  readonly bootstrapSync: BootstrapSynchronizer;
  readonly connectivity: Connectivity;
  /** Shared superseding runner for cancel-on-new-request search/fetch paths. */
  readonly run: <T>(fn: (signal: AbortSignal) => Promise<T>) => Promise<T>;
  /** Last bootstrap sync outcome — drives dev connectivity banner and offline UX. */
  readonly lastBootstrapSync: SyncResult | null;
}

let memoized: Promise<AppRuntime> | null = null;

async function buildAppRuntime(): Promise<AppRuntime> {
  const [{ store }, connectivity] = await Promise.all([
    createRuntimeCache(),
    createNetInfoConnectivity(),
  ]);

  const releaseCache = createReleaseCache(store);
  const transport = createTransport({ apiClient: createDefaultApiClient() });
  const bootstrapSync = createBootstrapSynchronizer({ transport, cache: releaseCache, store });
  const queryClient = createMobileQueryClient();
  const persister = createSqlitePersister(store);
  const run = createSupersedingRunner();

  return {
    store,
    queryClient,
    persister,
    transport,
    releaseCache,
    bootstrapSync,
    connectivity,
    run,
    lastBootstrapSync: null,
  };
}

/** Lazily builds (and memoizes) the process-wide runtime. */
export function getAppRuntime(): Promise<AppRuntime> {
  if (!memoized) {
    memoized = buildAppRuntime().catch((err) => {
      memoized = null;
      throw err;
    });
  }
  return memoized;
}

/** Test-only: replace or clear the memoized runtime. */
export function __resetAppRuntimeForTests(next: Promise<AppRuntime> | null = null): void {
  memoized = next;
}
