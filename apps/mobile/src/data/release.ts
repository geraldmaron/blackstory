/**
 * Release-stamp freshness comparison (MOB-009 / ADR-022 §4; threat-model T5).
 *
 * VENDORED from `packages/domain/src/publication/mobile-bootstrap.ts`
 * (`isReleaseStampStale`) because `@repo/domain` is not importable from
 * `apps/mobile` today (see contracts.ts INTEGRATION GAP). Kept behaviourally
 * identical: the stamp is the AUTHORITATIVE freshness signal for immutable
 * release content — a mismatch hard-invalidates release-coupled cache
 * regardless of TTL, and an absent client stamp (first launch, or a wiped
 * cache) is treated as stale so nothing stale-by-default is ever trusted.
 *
 * ADR-022 §4 resolution: a SINGLE GLOBAL stamp governs all release-coupled
 * cache. We do NOT implement per-artifact stamps — that was explicitly rejected
 * by the ADR-022 red-team as premature. Rollback (server re-points to a prior
 * release) is handled by the exact same equality check as roll-forward: the
 * stamp differs, so the cache invalidates. There is no special-casing and no
 * ordering assumption — we never assume stamps are monotonic, so a rollback to
 * an *older* stamp still reads as "different ⇒ invalidate" (threat-model T5
 * rollback-replay).
 */

/**
 * Returns true when the client's last-seen stamp differs from the server's
 * current stamp. Deliberately an equality check, not an ordering check: rollback
 * to a prior release must invalidate identically to a roll-forward.
 */
export function isReleaseStampStale(
  clientStamp: string | undefined,
  serverStamp: string,
): boolean {
  return clientStamp !== serverStamp;
}

/**
 * Whether a cached row written under `entryStamp` may be served for the current
 * `activeStamp`. Only exact-stamp matches are servable; everything else must be
 * dropped/refetched before display (threat-model T5: "never renders cache data
 * from a superseded release as current").
 */
export function isEntryServable(
  entryStamp: string,
  activeStamp: string,
): boolean {
  return entryStamp === activeStamp;
}
