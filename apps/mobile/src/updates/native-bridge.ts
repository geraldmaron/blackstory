/**
 * Defensive native-module loader for `expo-updates` (MOB-019, repo-ovn7;
 * ADR-023 §2/§7, threat-model T6).
 *
 * Mirrors `src/security/app-check.ts`'s `loadNativeAppCheck` and
 * `src/observability/native-bridge.ts`'s Crashlytics/Perf loaders: a
 * `require` (not a static import, so the load is lazy and catchable) wrapped
 * in a try/catch that returns `null` — never throws — when the native module
 * is absent (Expo Go, web, a test runner, or any environment without the
 * native `expo-updates` module linked). `expo-updates` is autolinked from
 * `package.json` in a real Expo/EAS build, so this loader exists for the
 * environments where it isn't (unit tests, `expo start --web`), not because
 * we expect it to actually fail in a real app build.
 */

/** Minimal `expo-updates` surface this app consumes. */
export interface NativeUpdatesSurface {
  /** True once `expo-updates` has resolved whether an update server is configured. */
  readonly isEnabled: boolean;
  /** Channel this binary's `eas.json` build profile was published under (ADR-023 §1). */
  readonly channel: string | null;
  /** EAS Update runtime version this binary was built with (ADR-023 §2). */
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
