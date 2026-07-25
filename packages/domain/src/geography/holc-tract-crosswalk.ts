/**
 * HOLC-polygon -> modern-census-tract crosswalk (repo-xez5.7).
 *
 * Schema for the historical-geography -> modern-tract linkage layer that lets a
 * theme-impact packet join a 1930s HOLC security-map polygon (bb_reference.holc_areas)
 * to the modern census tract(s) it now overlaps. This is the NCRC / Aaronson,
 * Hartley & Mazumder (2021, "The Effects of the 1930s HOLC 'Redlining' Maps")
 * linkage approach: area-weighted spatial overlay of the historical HOLC polygon
 * against current TIGER/Line tract boundaries, not a lookup by name or centroid.
 *
 * STATUS: schema + provenance-quartet convention only. No rows are populated by
 * this module yet. Producing real rows requires:
 *   1. TIGER/Line current-vintage tract boundary shapefiles (census.gov/geo/tiger),
 *   2. a polygon-overlay library (e.g. turf.js `intersect`/`area`, or a GIS runtime
 *      such as GDAL/PostGIS `ST_Intersection`) — neither is a dependency of this
 *      repo today,
 *   3. the HOLC polygon geometries themselves, which live only in the archived
 *      Storage object referenced by bb_reference.holc_areas.geometry
 *      (raw-sources/mapping-inequality/2023-full-download/mappinginequality.json),
 *      not inline in Postgres.
 * A follow-up loader (packages/ops-data/scripts/ingest-holc-tract-crosswalk.ts,
 * not yet written) should: load that GeoJSON, load TIGER tract boundaries for the
 * target county/state, compute area-weighted overlay fractions per HOLC area id,
 * and upsert one HolcTractCrosswalkRow per (holcAreaId, tractGeoid) pair with
 * shareOfHolcAreaInTract >= a minimum threshold (e.g. 0.05) to avoid slivers.
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
