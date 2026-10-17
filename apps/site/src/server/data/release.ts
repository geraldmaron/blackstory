/**
 * The active-release pointer: which release is live, and since when. Every release-scoped cache key
 * contains it, so this is what makes a new release visible. Memoized for 30 seconds (the same window
 * the Next app used) with single-flight, so a burst reads the pointer once.
 */
import { createSingleFlight } from './primitives';
import type { ReleaseKey } from './cache';

export const ACTIVE_RELEASE_POINTER_TTL_MS = 30_000;

export type ReleaseDeps = {
  readonly fetchActive: () => Promise<{ releaseId: string; activatedAt: string } | undefined>;
  readonly isLive: () => boolean;
  readonly now: () => number;
};

export type ReleasePointer = {
  /** The live release, or undefined when public data is not configured to read Postgres. */
  getActiveRelease(): Promise<ReleaseKey | undefined>;
  invalidate(): void;
  stats(): {
    readonly cached: boolean;
    readonly expiresInMs: number | null;
    readonly releaseId: string | null;
  };
};

export function createReleasePointer(deps: ReleaseDeps): ReleasePointer {
  let memo: { value: ReleaseKey; expiresAtMs: number } | undefined;
  const singleFlight = createSingleFlight();
  // Bumped by invalidate(): a query already in flight may answer its caller but not write the memo,
  // and a reader after the invalidation never joins it (it would hand back the release just purged).
  let generation = 0;

  return {
    async getActiveRelease() {
      if (!deps.isLive()) return undefined;
      const at = deps.now();
      if (memo && memo.expiresAtMs > at) return memo.value;
      const startedGeneration = generation;
      return singleFlight(`active-release:${startedGeneration}`, async () => {
        const active = await deps.fetchActive();
        if (!active) return undefined;
        const value = { releaseId: active.releaseId, activatedAt: active.activatedAt };
        if (startedGeneration !== generation) return value;
        // An undefined pointer is never memoized: a transient miss must not pin "no release" for 30 s.
        memo = { value, expiresAtMs: deps.now() + ACTIVE_RELEASE_POINTER_TTL_MS };
        return value;
      });
    },
    invalidate() {
      generation += 1;
      memo = undefined;
    },
    stats() {
      const at = deps.now();
      const live = memo && memo.expiresAtMs > at ? memo : undefined;
      return {
        cached: live !== undefined,
        expiresInMs: live ? live.expiresAtMs - at : null,
        releaseId: live?.value.releaseId ?? null,
      };
    },
  };
}
