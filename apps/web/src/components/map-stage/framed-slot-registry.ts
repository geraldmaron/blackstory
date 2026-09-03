/**
 * The one-Framed-slot-per-viewport guard.
 *
 * Design law: `docs/ui/design-direction-v9-surfaces.md` §3.
 *
 * There is one plate, so at most one in-flow slot can hold it. `MapMomentStage` already makes a
 * double claim structurally impossible WITHIN one stage — `pickLiveMoment` is a winner-take-all
 * pick over the registered moments, so only one moment is ever live. What this registry guards is
 * the case that arbitration cannot see: two stages mounted at once. A record page's place frame
 * plus a chapter moment, or two layouts each mounting their own stage. Neither knows about the
 * other, and both would otherwise drive the same plate's geometry in the same frame.
 *
 * A refused claim is not an error. The caller already has a correct render path: `MapMoment` shows
 * its caption and its idle line, which is the honest result — the point of a moment is the
 * sentence under it, and the map is the illustration.
 */

export type FramedSlotRegistry = {
  /**
   * Take the slot for `id`. Returns whether `id` now holds it.
   *
   * Idempotent for the current holder: re-claiming returns `true`.
   */
  readonly claim: (id: string) => boolean;
  /** Give up the slot. A no-op unless `id` is the current holder. */
  readonly release: (id: string) => void;
  /** Who holds the slot, or `null`. */
  readonly holder: () => string | null;
};

/**
 * Two behaviors here are the whole point of the module, and both are things a three-line
 * implementation gets wrong:
 *
 * 1. `claim` by the CURRENT holder returns `true`, not `false`. A moment re-registers on every
 *    re-render and on every camera change. If a re-claim read as a conflict, the holder would
 *    lose its own slot to itself and the plate would flicker between framed and parked at React's
 *    render rate.
 *
 * 2. `release(id)` where `id` is not the holder is inert. React mounts the incoming tree before
 *    unmounting the outgoing one, so during a navigation the new slot claims and only then does
 *    the old slot's cleanup run. A release that did not check the id would tear down the claim
 *    the incoming slot had just made, and the plate would park on a page that wanted it framed.
 */
export function createFramedSlotRegistry(): FramedSlotRegistry {
  let held: string | null = null;

  return {
    claim(id: string): boolean {
      if (held === null || held === id) {
        held = id;
        return true;
      }
      return false;
    },
    release(id: string): void {
      if (held === id) held = null;
    },
    holder(): string | null {
      return held;
    },
  };
}
