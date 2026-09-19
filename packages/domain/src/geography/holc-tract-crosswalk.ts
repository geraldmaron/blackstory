/**
 * Schema for area-weighted overlap between historical HOLC polygons and modern Census tracts.
 * This module supplies no populated crosswalk. A loader needs both boundary vintages, polygon
 * intersection and area calculations, source hashes and per-pair overlap fractions. Name or
 * centroid matching cannot substitute for that overlay.
 */

/** Provenance quartet convention shared with ThemeImpactProvenanceQuartet. */
export type CrosswalkProvenanceQuartet = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly humanCitation: string;
};

export const HOLC_TRACT_CROSSWALK_METHODS = [
  /** Area-weighted polygon overlay (NCRC / Aaronson-Hartley-Mazumder approach). */
  'area_weighted_overlay',
  /** Point-in-polygon test on the HOLC polygon centroid only (coarser fallback). */
  'centroid_point_in_polygon',
] as const;
export type HolcTractCrosswalkMethod = (typeof HOLC_TRACT_CROSSWALK_METHODS)[number];

export const HOLC_TRACT_CROSSWALK_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type HolcTractCrosswalkConfidence = (typeof HOLC_TRACT_CROSSWALK_CONFIDENCE_LEVELS)[number];

/**
 * One HOLC-area -> modern-tract link. `shareOfHolcAreaInTract` and
 * `shareOfTractInHolcArea` are the two area-weighted overlap fractions used by
 * Aaronson et al.-style crosswalks to apportion tract-level outcomes back onto
 * historical HOLC grades (and vice versa).
 */
export type HolcTractCrosswalkRow = {
  readonly holcAreaId: string;
  readonly holcGrade: string | null;
  readonly holcCity: string;
  readonly holcState: string;
  readonly tractGeoid: string;
  readonly tractBoundaryVintage: string;
  readonly shareOfHolcAreaInTract: number;
  readonly shareOfTractInHolcArea: number;
  readonly method: HolcTractCrosswalkMethod;
  readonly confidence: HolcTractCrosswalkConfidence;
  readonly provenance: CrosswalkProvenanceQuartet;
};

/**
 * No rows are populated yet (see module doc for the blocker). Kept as a typed,
 * empty, checked-in dataset so downstream code can depend on the shape now and
 * fail on `gap_state` rather than silently treating "no crosswalk" as success.
 */
export const HOLC_TRACT_CROSSWALK_ROWS: readonly HolcTractCrosswalkRow[] = [];

export function findTractsForHolcArea(
  holcAreaId: string,
  rows: readonly HolcTractCrosswalkRow[] = HOLC_TRACT_CROSSWALK_ROWS,
): readonly HolcTractCrosswalkRow[] {
  return rows.filter((row) => row.holcAreaId === holcAreaId);
}
