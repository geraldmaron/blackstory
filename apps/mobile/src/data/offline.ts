/**
 * Connectivity signal (MOB-009 §6; threat-model T7).
 *
 * The data layer needs to know whether it is online so reads can fall back to
 * cache with an explicit degraded signal (the `FreshnessSignal.degraded` flag in
 * release-cache.ts). This module owns ONLY the connectivity source; it builds no
 * UI (MOB-012+ renders the banner). It is abstracted behind `Connectivity` so
 * the fallback logic is testable without the native NetInfo module and so a
 * hostile network that merely drops packets (T7) is modelled the same as a
 * clean offline transition.
 *
 * Honesty invariant (T7): being offline NEVER silently mutates cached data or
 * marks it current. It only flips `degraded` so every served surface is labelled
 * "last updated <fetchedAt>".
 */

export type ConnectivityState = 'online' | 'offline' | 'unknown';

export interface Connectivity {
  getState(): ConnectivityState;
  isOnline(): boolean;
  subscribe(listener: (state: ConnectivityState) => void): () => void;
}

/** In-memory connectivity — the test double AND the safe default before NetInfo
 * reports (we start 'unknown', treated as online-attempt: we still TRY the
 * network; the transport's failure path handles a real outage). */
export function createManualConnectivity(initial: ConnectivityState = 'unknown'): Connectivity & {
  set(state: ConnectivityState): void;
} {
  let state = initial;
  const listeners = new Set<(s: ConnectivityState) => void>();
  return {
    getState: () => state,
    // 'unknown' is treated as online for the ATTEMPT — we never refuse to try
    // the network just because NetInfo has not reported yet (T7: do not
    // manufacture an offline state).
    isOnline: () => state !== 'offline',
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      state = next;
      for (const l of listeners) l(next);
    },
  };
}

/**
 * NetInfo-backed connectivity. Lazily imports `@react-native-community/netinfo`
 * so the native module never loads in the test runner. Not imported by tests.
 */
export async function createNetInfoConnectivity(): Promise<Connectivity> {
  const NetInfo = (await import('@react-native-community/netinfo')).default;
  const manual = createManualConnectivity('unknown');
  const map = (reachable: boolean | null, connected: boolean | null): ConnectivityState => {
    if (connected === false) return 'offline';
    if (reachable === false) return 'offline';
    if (connected === true) return 'online';
    return 'unknown';
  };
  const current = await NetInfo.fetch();
  manual.set(map(current.isInternetReachable, current.isConnected));
  NetInfo.addEventListener((s) => manual.set(map(s.isInternetReachable, s.isConnected)));
  return manual;
}
