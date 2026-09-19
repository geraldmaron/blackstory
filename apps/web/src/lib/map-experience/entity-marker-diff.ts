/**
 * Keyed diff for the DOM entity hit-target markers (`.ds-map-entity-marker`).
 *
 * A `zoomend` or data sync must not rebuild the whole marker collection because a mass
 * unmount/remount makes every pin change visual state at once. The single-feature invariant used
 * by the canvas layers also applies to the DOM marker path: a selection change may repaint only
 * the selected feature. Markers are keyed by
 * `entityId`, kept instances are mutated in place, and only genuinely new/stale ids mount or
 * unmount.
 */

export type EntityMarkerDiff = {
  /** Ids present both in the mounted set and the next feature set — reuse in place. */
  readonly keep: readonly string[];
  /** Ids in the next feature set with no mounted marker — create. */
  readonly add: readonly string[];
  /** Mounted ids no longer present — remove only these. */
  readonly remove: readonly string[];
};

/** Stable keyed diff between the mounted marker ids and the next feature id set. */
export function diffEntityMarkerIds(
  mountedIds: Iterable<string>,
  nextIds: Iterable<string>,
): EntityMarkerDiff {
  const mounted = new Set(mountedIds);
  const next = new Set(nextIds);
  const keep: string[] = [];
  const add: string[] = [];
  const remove: string[] = [];
  for (const id of next) {
    if (mounted.has(id)) keep.push(id);
    else add.push(id);
  }
  for (const id of mounted) {
    if (!next.has(id)) remove.push(id);
  }
  return { keep, add, remove };
}

/**
 * DOM hit-target markers are fixed-pixel discs; the GL circles beneath scale with zoom. Below
 * the cluster gate the discs must be unmounted — and during a camera ease that crosses the
 * gate (closing a record card flies from point zoom back out), they must unmount at the
 * crossing, not at `zoomend`, or every disc rides the whole flight oversized (the flash).
 */
export function shouldMountEntityMarkers(zoom: number, clusterMaxZoom: number): boolean {
  return zoom > clusterMaxZoom;
}
