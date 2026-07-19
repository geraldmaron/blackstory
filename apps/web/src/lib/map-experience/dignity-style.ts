/**
 * Map color tokens for kind encoding, semantic tones (massacre / plantation /
 * epicenter), confidence, and light/dark plate variants. Product direction
 * (the related workstream) expands beyond the copper-only archive register: confidence
 * runs green→orange, and certain historical tones use red/gold/black while
 * every marker still carries a non-color glyph (WCAG 1.4.1).
 */
import { brandPalette } from '@repo/ui';

export const EXPLORE_CLUSTER_CONFIG = {
  /** Pixel radius for grouping nearby points — tighter than default so metro clouds collapse. */
  clusterRadius: 52,
  /** Keep aggregates through state/locality; individuals emerge past this zoom. */
  clusterMaxZoom: 12,
  clusterMinPoints: 2,
} as const;

/** Cluster disc radii by point_count, then scaled by zoom in explore-style (national shrink). */
export const CLUSTER_RADIUS_BY_COUNT: ReadonlyArray<readonly [minCount: number, radius: number]> = [
  [0, 10],
  [10, 14],
  [50, 18],
  [200, 22],
];

/** OpenFreeMap vector tiles + fonts — free street basemap under the archive layers. */
export const OPENFREEMAP_TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet';
export const OPENFREEMAP_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const OPENFREEMAP_SOURCE_ID = 'openfreemap';

export type MapColorScheme = 'light' | 'dark';

export const DIGNITY_PALETTE = {
  point: brandPalette.copperPin,
  pointHalo: brandPalette.pageSand,
  cluster: brandPalette.copperInk,
  clusterText: brandPalette.archivePaper,
  densityLow: 'rgba(184, 107, 42, 0.12)',
  densityMid: 'rgba(184, 107, 42, 0.28)',
  densityHigh: 'rgba(184, 107, 42, 0.5)',
  background: brandPalette.blackInk,
  ocean: '#080606',
  oceanLight: '#E8E0D2',
  border: '#34302C',
  borderLight: brandPalette.rule,
  selected: brandPalette.archivePaper,
  selectedDark: brandPalette.blackInk,
  selectedStateFill: 'rgba(184, 107, 42, 0.35)',
  densityUnknownFill: 'rgba(216, 161, 120, 0.12)',
  densityDisabledFill: 'rgba(216, 161, 120, 0.14)',
  densityUnknownFillLight: 'rgba(184, 107, 42, 0.08)',
  densityDisabledFillLight: 'rgba(109, 103, 95, 0.08)',

  kindPerson: brandPalette.copperPin,
  kindPlace: '#E09A55',
  kindSchool: '#7A8B52',
  kindOrganization: '#9A5828',
  kindInstitution: '#8B7355',
  kindInstitutionStroke: '#C9BA9A',
  kindEvent: brandPalette.copperDark,
  kindLaw: '#356494',
  kindCase: '#7BA8D4',
  kindPublication: '#5C6B4E',
  kindArtifact: '#A68968',
  kindMovement: '#C4683A',
  kindOther: brandPalette.stone,

  kindMassacre: '#B83A2A',
  kindPlantation: '#0A0A0A',
  kindEpicenter: '#C9A227',

  confidenceHigh: '#2F6B3C',
  confidenceMedium: '#8B8A2E',
  confidenceLow: '#D07A32',
  confidenceUnrated: brandPalette.stone,

  streetCasingDark: 'rgba(244, 239, 229, 0.22)',
  streetDark: 'rgba(244, 239, 229, 0.38)',
  streetLabelDark: 'rgba(244, 239, 229, 0.55)',
  streetCasingLight: 'rgba(10, 10, 10, 0.18)',
  streetLight: 'rgba(10, 10, 10, 0.32)',
  streetLabelLight: 'rgba(10, 10, 10, 0.55)',
} as const;

export const DENSITY_TIER_FILL: Readonly<Record<'documented' | 'emerging' | 'concentrated', string>> = {
  documented: DIGNITY_PALETTE.densityLow,
  emerging: DIGNITY_PALETTE.densityMid,
  concentrated: DIGNITY_PALETTE.densityHigh,
};

/** Black share of county population — copper/sand opacity scale (never alarm red). */
export const POPULATION_SHARE_TIER_FILL: Readonly<
  Record<'trace' | 'low' | 'mid' | 'high' | 'majority', string>
> = {
  trace: 'rgba(184, 107, 42, 0.08)',
  low: 'rgba(184, 107, 42, 0.16)',
  mid: 'rgba(216, 161, 120, 0.28)',
  high: 'rgba(184, 107, 42, 0.38)',
  majority: 'rgba(184, 107, 42, 0.52)',
};

/** Decade-over-decade share change — copper gain, stone loss, neutral sand. */
export const POPULATION_CHANGE_TIER_FILL: Readonly<
  Record<'gainStrong' | 'gainModerate' | 'neutral' | 'lossModerate' | 'lossStrong', string>
> = {
  gainStrong: 'rgba(184, 107, 42, 0.48)',
  gainModerate: 'rgba(216, 161, 120, 0.32)',
  neutral: 'rgba(216, 161, 120, 0.12)',
  lossModerate: 'rgba(109, 103, 95, 0.28)',
  lossStrong: 'rgba(109, 103, 95, 0.42)',
};

export const POPULATION_CHANGE_TIER_GLYPH: Readonly<
  Record<'gainStrong' | 'gainModerate' | 'neutral' | 'lossModerate' | 'lossStrong', string>
> = {
  gainStrong: '↑',
  gainModerate: '↗',
  neutral: '·',
  lossModerate: '↘',
  lossStrong: '↓',
};

export const CONFIDENCE_TIER_GLYPH: Readonly<Record<string, string>> = {
  high: '●',
  medium: '◐',
  low: '○',
  unrated: '·',
};

export const CONFIDENCE_TIER_COLOR: Readonly<Record<string, string>> = {
  high: DIGNITY_PALETTE.confidenceHigh,
  medium: DIGNITY_PALETTE.confidenceMedium,
  low: DIGNITY_PALETTE.confidenceLow,
  unrated: DIGNITY_PALETTE.confidenceUnrated,
};

/** Light plate ocean — pure white per cartography direction (pre-flash matches in map-surfaces.css). */
export const LIGHT_PLATE_OCEAN = '#FFFFFF';

export function plateForScheme(scheme: MapColorScheme) {
  if (scheme === 'light') {
    return {
      ocean: LIGHT_PLATE_OCEAN,
      selected: DIGNITY_PALETTE.selectedDark,
      densityUnknown: DIGNITY_PALETTE.densityUnknownFillLight,
      densityDisabled: DIGNITY_PALETTE.densityDisabledFillLight,
      streetCasing: DIGNITY_PALETTE.streetCasingLight,
      street: DIGNITY_PALETTE.streetLight,
      streetLabel: DIGNITY_PALETTE.streetLabelLight,
      clusterText: DIGNITY_PALETTE.selectedDark,
      /** State bounds — copper brown; stronger than county hairlines on the white plate. */
      stateBounds: brandPalette.copperTextLight,
      /** County hairlines — stone (not rule): rule (#D7D0C4) vanishes on white; stone stays distinct from stateBounds brown. */
      countyLine: brandPalette.stone,
      /** County name labels — stone text + white halo (WCAG: color is not the only boundary signal). */
      countyLabel: brandPalette.stone,
      countyLabelHalo: LIGHT_PLATE_OCEAN,
    } as const;
  }
  return {
    ocean: DIGNITY_PALETTE.ocean,
    selected: DIGNITY_PALETTE.selected,
    densityUnknown: DIGNITY_PALETTE.densityUnknownFill,
    densityDisabled: DIGNITY_PALETTE.densityDisabledFill,
    streetCasing: DIGNITY_PALETTE.streetCasingDark,
    street: DIGNITY_PALETTE.streetDark,
    streetLabel: DIGNITY_PALETTE.streetLabelDark,
    clusterText: DIGNITY_PALETTE.clusterText,
    /** Dark branch frozen — warm pageSand state ruling (explore-state-bounds-line legacy). */
    stateBounds: DIGNITY_PALETTE.pointHalo,
    /** Dark county hairlines — archivePaper ink (was plate.selected before theme split). */
    countyLine: DIGNITY_PALETTE.selected,
    countyLabel: DIGNITY_PALETTE.streetLabelDark,
    countyLabelHalo: DIGNITY_PALETTE.ocean,
  } as const;
}
