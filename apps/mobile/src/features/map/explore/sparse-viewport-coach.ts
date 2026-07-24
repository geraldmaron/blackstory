/**
 * Sparse-viewport coaching copy for Explore — when the map reports a region with
 * zero pins (filters or framing), surface a compact on-map coach without burying
 * the plate. Pure helper so chrome and tests share one contract.
 */

export const SPARSE_VIEWPORT_COACH_COPY =
  'No pins in this view. Pan, zoom out, or clear a filter.' as const;

export type SparseViewportCoachInput = {
  readonly inViewCount: number;
  /** Full release total still loaded (coach only when the archive is not empty). */
  readonly releaseCount: number;
};

/** True when the viewport/filter intersection is empty but the release still has pins. */
export function shouldShowSparseViewportCoach(input: SparseViewportCoachInput): boolean {
  return input.releaseCount > 0 && input.inViewCount === 0;
}
