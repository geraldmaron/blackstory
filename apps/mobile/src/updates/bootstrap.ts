/**
 * Runtime wiring that binds the pure `config.ts` resolver to the real
 * `expo-updates` native module (MOB-019, repo-ovn7). Kept separate from the
 * pure/testable module so `config.ts` stays free of native calls — the same
 * split `src/observability/bootstrap.ts` uses for Crashlytics/Perf and
 * `src/security/bootstrap.ts` uses for App Check.
 *
 * NOT wired into the app's entry point by this bead — that composition-root
 * call (alongside `initializeObservability`/`bootstrapAppCheck`) belongs to
 * whichever bead owns `src/runtime/AppProviders.tsx` (MOB-008 lineage), per
 * the same boundary `observability/bootstrap.ts` documents for itself. This
 * module exists so that wiring is a one-line call away once made, not so
 * this bead reaches into another bead's exclusive file.
 */
import { resolveUpdatesPosture, type UpdatesPosture } from './config';
import { loadNativeUpdates } from './native-bridge';

/** Current OTA posture, gathered from the real native module. Never throws. */
export function getUpdatesPosture(): UpdatesPosture {
  try {
    return resolveUpdatesPosture(loadNativeUpdates());
  } catch {
    return resolveUpdatesPosture(null);
  }
}

export type CheckForUpdateResult =
  | { readonly checked: true; readonly isAvailable: boolean }
  | { readonly checked: false; readonly reason: string };

/**
 * Check the configured channel for a newer immutable update
 * (`updateId` — ADR-023 §2). Never throws: disabled/absent `expo-updates`
 * (pre-EAS-project human gate, Expo Go, web, tests) resolves to
 * `{ checked: false }`, which callers treat identically to "no update
 * available" — this is a background check, never a blocking one (ADR-023 §4
 * fail-open posture: absence of a signal is never treated as an error).
 */
export async function checkForUpdate(): Promise<CheckForUpdateResult> {
  const native = loadNativeUpdates();
  if (!native || !native.isEnabled) {
    return {
      checked: false,
      reason: 'expo-updates disabled (no EAS project configured — see README "Human gate")',
    };
  }
  try {
    const result = await native.checkForUpdateAsync();
    return { checked: true, isAvailable: result.isAvailable };
  } catch (error) {
    return { checked: false, reason: describeError(error) };
  }
}

export type ApplyUpdateResult =
  | { readonly applied: true }
  | { readonly applied: false; readonly reason: string };

/**
 * Fetch a newer update and reload the app onto it. This is the client half
 * of ADR-023 §2's OTA path — the server/publish half (which update is
 * "current" on a channel) is entirely controlled by whoever holds the
 * MFA-custodied EAS publish credential (README "MFA custody"), never by this
 * client. Never throws: a fetch/reload failure degrades to `applied: false`
 * and the caller keeps running on the current bundle (fail-open — a failed
 * OTA apply must never crash or hang the app already in the user's hands).
 */
export async function fetchAndApplyUpdate(): Promise<ApplyUpdateResult> {
  const native = loadNativeUpdates();
  if (!native || !native.isEnabled) {
    return { applied: false, reason: 'expo-updates disabled' };
  }
  try {
    const fetchResult = await native.fetchUpdateAsync();
    if (!fetchResult.isNew) {
      return { applied: false, reason: 'no new update fetched' };
    }
    await native.reloadAsync();
    return { applied: true };
  } catch (error) {
    return { applied: false, reason: describeError(error) };
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
