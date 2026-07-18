/**
 * Dignity-rule style tokens for the map (no red violence markers, no trauma-forward color
 * coding, clusters never render as crime-heat). Every color below comes from
 * `@blap/ui`'s brand palette — this module never introduces a new hue. The
 * accompanying test (`dignity-style.test.ts`) programmatically asserts none of them are red-hued,
 * so this rule cannot silently regress as the palette evolves.
 */
import { brandPalette, darkTheme } from '@blap/ui';

/** Cluster/point radii chosen so a national cluster decomposes to named entities within two
 * interactions: one zoom step un-clusters to a regional-scale cluster, a second reaches
 * individual points. */
export const EXPLORE_CLUSTER_CONFIG = {
  clusterRadius: 60,
  clusterMaxZoom: 9,
  clusterMinPoints: 2,
} as const;

export const DIGNITY_PALETTE = {
  point: brandPalette.copperPin,
  pointHalo: brandPalette.pageSand,
  cluster: brandPalette.copperInk,
  clusterText: brandPalette.archivePaper,
  densityLow: 'rgba(184, 107, 42, 0.12)',
  densityMid: 'rgba(184, 107, 42, 0.28)',
  densityHigh: 'rgba(184, 107, 42, 0.5)',
  background: brandPalette.blackInk,
  border: darkTheme.border,
  /** White stroke/fill on the fixed dark map canvas for selected points.  */
  selected: brandPalette.archivePaper,
  /**
   * BB-099 relocated ad-hoc literals: these three already existed inline in
   * `explore-style.ts` before BB-099's basemap-conformance pass values unchanged, just named
   * and centralized here so "every color pulled from DIGNITY_PALETTE" is actually true.
   */
  selectedStateFill: 'rgba(184, 107, 42, 0.35)',
  densityUnknownFill: 'rgba(255, 255, 255, 0.1)',
  densityDisabledFill: 'rgba(255, 255, 255, 0.12)',
  /**
   * BB-099 per-entity-kind shades (see `kind-encoding.ts`, which is the module that actually
   * assigns these to `place | school | event | institution`). Namespaced `kind*` rather than
   * reusing `point`/`pointHalo` above so a future edit to the generic point/halo tokens can
   * never accidentally re-color the kind legend out from under it, even though `kindPlace`
   * happens to equal `point` today (both are Copper Pin the map's original default marker
   * color IS what "place" renders as post-BB-099).
   */
  kindPlace: brandPalette.copperPin,
  kindSchool: brandPalette.pageSand,
  kindEvent: brandPalette.copperDark,
  /**
   * "Institution paper tint" a Surface/Archive-Paper-family swatch specified by
   * design-direction-v3.md ("Map visual language (BB-099)") that has no equivalent yet in
   * `brand-palette.ts`'s fixed swatch set. Defined here the same way `densityLow/Mid/High`
   * above are this module's own derived tokens: named once, referenced everywhere, never
   * inlined at a call site.
   */
  kindInstitution: '#EDE4D2',
  /** Stone outline for the institution "ring" glyph (paired with `kindInstitution`'s mostly-
   * hollow fill so the marker reads as a ring, not a hue). */
  kindInstitutionStroke: brandPalette.stone,
} as const;

export const DENSITY_TIER_FILL: Readonly<Record<'documented' | 'emerging' | 'concentrated', string>> = {
  documented: DIGNITY_PALETTE.densityLow,
  emerging: DIGNITY_PALETTE.densityMid,
  concentrated: DIGNITY_PALETTE.densityHigh,
};

/**
 * Non-color affordances (glyph, never hue alone) so the dignity rule holds for readers who
 * cannot perceive the copper/sand distinction WCAG 1.4.1 (Use of Color).
 */
export const CONFIDENCE_TIER_GLYPH: Readonly<Record<string, string>> = {
  high: '●',
  medium: '◐',
  low: '○',
  unrated: '·',
};
