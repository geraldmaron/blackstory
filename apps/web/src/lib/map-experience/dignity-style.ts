/**
 * Dignity-rule style tokens for the map (no red violence markers, no trauma-forward color
 * coding, clusters never render as crime-heat). Every color below comes from
 * `@black-book/ui`'s brand palette — this module never introduces a new hue. The
 * accompanying test (`dignity-style.test.ts`) programmatically asserts none of them are red-hued,
 * so this rule cannot silently regress as the palette evolves.
 */
import { brandPalette, darkTheme } from '@black-book/ui';

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
