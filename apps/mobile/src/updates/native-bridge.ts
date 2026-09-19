/**
 * Load expo-updates lazily and return null if unavailable, such as in Expo Go, web or tests. A
 * real native build must link the dependency; defensive loading is not proof that updates are
 * configured.
 */

/** Minimal `expo-updates` surface this app consumes. */
export interface NativeUpdatesSurface {
  /** True once `expo-updates` has resolved whether an update server is configured. */
  readonly isEnabled: boolean;
  /**
   * Channel this binary's `eas.json` build profile was published under
   * (ADR-024 §1; restated in `docs/decisions-carryover.md`, "Mobile cache
   * and OTA release").
   */
  readonly channel: string | null;
  /**
   * EAS Update runtime version this binary was built with (ADR-024 §2;
   * restated in `docs/decisions-carryover.md`, "Mobile cache and OTA
   * release").
   */
  readonly runtimeVersion: string | null;
  /** Immutable OTA bundle id currently running, or `null` on the embedded/store bundle. */
  readonly updateId: string | null;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean; manifest?: unknown }>;
  fetchUpdateAsync(): Promise<{ isNew: boolean }>;
  reloadAsync(): Promise<void>;
}

/**
 * Load `expo-updates` defensively. Returns `null` (never throws) when the
 * package is not installed, has no native backing, or does not expose the
 * expected shape — e.g. `expo start --web`, Expo Go, or a Jest environment
 * with no native modules linked.
 */
export function loadNativeUpdates(): NativeUpdatesSurface | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-updates') as {
      isEnabled?: boolean;
      channel?: string | null;
      runtimeVersion?: string | null;
      updateId?: string | null;
      checkForUpdateAsync?: () => Promise<{ isAvailable: boolean; manifest?: unknown }>;
      fetchUpdateAsync?: () => Promise<{ isNew: boolean }>;
      reloadAsync?: () => Promise<void>;
    };
    if (
      typeof mod?.checkForUpdateAsync !== 'function' ||
      typeof mod?.fetchUpdateAsync !== 'function' ||
      typeof mod?.reloadAsync !== 'function'
    ) {
      return null;
    }
    return {
      isEnabled: mod.isEnabled === true,
      channel: mod.channel ?? null,
      runtimeVersion: mod.runtimeVersion ?? null,
      updateId: mod.updateId ?? null,
      checkForUpdateAsync: mod.checkForUpdateAsync,
      fetchUpdateAsync: mod.fetchUpdateAsync,
      reloadAsync: mod.reloadAsync,
    };
  } catch {
    return null;
  }
}
