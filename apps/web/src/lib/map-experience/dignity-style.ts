/**
 * Map color tokens for kind encoding, semantic tones (massacre / plantation /
 * epicenter), confidence, and light/dark plate variants. Product direction
 * (the related workstream) expands beyond the copper-only archive register: confidence
 * runs green→orange, and certain historical tones use red/gold/black while
 * every marker still carries a non-color glyph (WCAG 1.4.1).
 */
import { brandPalette, mapPalettes } from '@repo/ui';

export const EXPLORE_CLUSTER_CONFIG = {
  /** Pixel radius for grouping nearby points — tighter than default so metro clouds collapse. */
  clusterRadius: 52,
  /**
   * Keep aggregates through state/locality; individuals emerge past this zoom.
   * Must stay below `MAP_MAX_ZOOM` so expansion flights remain inside the envelope.
   */
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

/**
 * Satellite imagery — USGS National Map, `USGSImageryOnly`.
 *
 * Chosen over Esri World Imagery and MapTiler because it needs no API key, no account and no
 * billing, and because it is US federal work: public domain, so nothing here depends on a
 * commercial license that could change under the archive. Coverage is the United States only,
 * which is exactly the extent this map flies over (`US_CONUS_BOUNDS` bounds the camera).
 *
 * The service is an ArcGIS MapServer tile endpoint, so the path is `{z}/{y}/{x}` — row before
 * column, the reverse of the XYZ convention. Getting that backwards yields tiles that load
 * without error and show the wrong place, which is worse than a blank plate.
 */
export const USGS_IMAGERY_SOURCE_ID = 'usgs-imagery';
export const USGS_IMAGERY_HOST = 'https://basemap.nationalmap.gov';
export const USGS_IMAGERY_TILE_URL = `${USGS_IMAGERY_HOST}/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`;
/** The service stops serving imagery above this zoom; past it MapLibre overzooms the last tile. */
export const USGS_IMAGERY_MAX_ZOOM = 16;
export const USGS_IMAGERY_ATTRIBUTION =
  'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noreferrer">USGS The National Map</a>';

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
  /** Charcoal — reads as the darkest tone on the ink basemap (rim still carries contrast)
   * without presenting as a broken black square in the light legend panel. */
  kindPlantation: '#2C2824',
  kindEpicenter: '#C9A227',

  confidenceHigh: '#2F6B3C',
  confidenceMedium: '#8B8A2E',
  confidenceLow: '#D07A32',
  confidenceUnrated: brandPalette.stone,

  streetCasingDark: 'rgba(244, 239, 229, 0.22)',
  streetDark: 'rgba(244, 239, 229, 0.38)',
  streetLabelDark: 'rgba(244, 239, 229, 0.55)',
  streetCasingLight: 'rgba(10, 10, 10, 0.18)',
  streetLight: 'rgba(10, 10, 10, 0.22)',
  streetLabelLight: 'rgba(10, 10, 10, 0.55)',
} as const;

export const DENSITY_TIER_FILL: Readonly<
  Record<'documented' | 'emerging' | 'concentrated', string>
> = {
  documented: DIGNITY_PALETTE.densityLow,
  emerging: DIGNITY_PALETTE.densityMid,
  concentrated: DIGNITY_PALETTE.densityHigh,
};

/** Presence fill for one state polygon — tier match with plate-aware unknown fallback. */
export function resolveDensityFillColor(
  tier: string,
  plate: ReturnType<typeof plateForScheme>,
): string {
  if (tier === 'concentrated') return DENSITY_TIER_FILL.concentrated;
  if (tier === 'emerging') return DENSITY_TIER_FILL.emerging;
  if (tier === 'documented') return DENSITY_TIER_FILL.documented;
  return plate.densityUnknown;
}

/** Black share of county population — copper/sand opacity scale (never alarm red). */
export const POPULATION_SHARE_TIER_FILL: Readonly<
  Record<'trace' | 'low' | 'mid' | 'high' | 'majority', string>
> = {
  trace: 'rgba(184, 107, 42, 0.08)',
  low: 'rgba(184, 107, 42, 0.16)',
  mid: 'rgba(184, 107, 42, 0.28)',
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

/**
 * Plate color for a scheme.
 *
 * `land`, `water`, `stateBounds` and `countyLine` come from `mapPalettes` in `@repo/ui`, which is
 * the source of truth for the plate: MapLibre styles are JSON, not CSS, so the TypeScript export
 * leads and `tokens.css` mirrors it. Those four carry the ΔL\* contract from design law §3 and are
 * contract-tested in `map-contrast.test.ts` — do not hand-tune them here.
 *
 * The remaining members are still local literals. They are pin, cluster, density and history
 * encoding, not plate cartography, and §3 does not govern them.
 */
export function plateForScheme(scheme: MapColorScheme) {
  if (scheme === 'light') {
    return {
      /**
       * The background is LAND. The plate draws real cartography: OpenFreeMap's `water`
       * source-layer paints the oceans, lakes and rivers over it, so coastline comes from the
       * tiles rather than from the edge of the state polygons. Before this the background was
       * water and the only landmass was the 49 state shapes, which is why the plate read as a
       * floating chart of the United States with no coast, no lakes and no continent around it.
       */
      ocean: mapPalettes.light.land,
      land: mapPalettes.light.land,
      water: mapPalettes.light.water,
      green: mapPalettes.light.green,
      /** Country boundary. Solid and heavier than `stateBounds`. */
      countryBounds: mapPalettes.light.line2,
      road: mapPalettes.light.road,
      /** Place labels from the vector tiles: state register and city/town register. */
      placeLabel: mapPalettes.light.label,
      placeLabelHi: mapPalettes.light.labelHi,
      placeLabelHalo: mapPalettes.light.halo,
      selected: DIGNITY_PALETTE.selectedDark,
      densityUnknown: DIGNITY_PALETTE.densityUnknownFillLight,
      densityDisabled: DIGNITY_PALETTE.densityDisabledFillLight,
      streetCasing: DIGNITY_PALETTE.streetCasingLight,
      street: DIGNITY_PALETTE.streetLight,
      streetLabel: DIGNITY_PALETTE.streetLabelLight,
      clusterText: DIGNITY_PALETTE.selectedDark,
      /** State bounds. `line` is contrast-held against `land` by design law §3. */
      stateBounds: mapPalettes.light.line,
      /**
       * County hairlines stay a local value. The §3 token table has no county role — its `line-2`
       * is the *country* border, heavier than `line`, and using it here would make counties
       * out-read states. Stone is deliberate: `rule` (#D7D0C4) vanishes against land.
       */
      countyLine: brandPalette.stone,
      /** County name labels — stone text + white halo (WCAG: color is not the only boundary signal). */
      countyLabel: brandPalette.stone,
      countyLabelHalo: LIGHT_PLATE_OCEAN,
      /**
       * History relationship lines — copper brown on white (≥3:1 non-text). pageSand
       * (`pointHalo`) reads as invisible wash on the light plate (~2.3:1).
       */
      historyEdge: brandPalette.copperTextLight,
      /** Selected relationship line — Copper Pin accent (navigational signal). */
      historyEdgeSelected: brandPalette.copperPin,
    } as const;
  }
  return {
    /** See the light branch: the background is land, and the tiles supply the water. */
    ocean: mapPalettes.dark.land,
    land: mapPalettes.dark.land,
    water: mapPalettes.dark.water,
    green: mapPalettes.dark.green,
    countryBounds: mapPalettes.dark.line2,
    road: mapPalettes.dark.road,
    placeLabel: mapPalettes.dark.label,
    placeLabelHi: mapPalettes.dark.labelHi,
    placeLabelHalo: mapPalettes.dark.halo,
    selected: DIGNITY_PALETTE.selected,
    densityUnknown: DIGNITY_PALETTE.densityUnknownFill,
    densityDisabled: DIGNITY_PALETTE.densityDisabledFill,
    streetCasing: DIGNITY_PALETTE.streetCasingDark,
    street: DIGNITY_PALETTE.streetDark,
    streetLabel: DIGNITY_PALETTE.streetLabelDark,
    clusterText: DIGNITY_PALETTE.selectedDark,
    stateBounds: mapPalettes.dark.line,
    /** Local, for the reason given on the light branch: §3 has no county role. */
    countyLine: DIGNITY_PALETTE.selected,
    countyLabel: DIGNITY_PALETTE.streetLabelDark,
    countyLabelHalo: DIGNITY_PALETTE.ocean,
    /**
     * History relationship lines — copper on ink (≥3:1). pageSand blends into presence
     * density fills; copperDark stays a clear navigational signal without alarm red.
     */
    historyEdge: brandPalette.copperDark,
    historyEdgeSelected: DIGNITY_PALETTE.point,
  } as const;
}

/**
 * The plate's roles, with values widened to `string`.
 *
 * `plateForScheme` returns `as const`, so its own return type is a union of two objects whose
 * every value is a literal hex — which is useful for reading the table and useless for building
 * one. Anything that derives a plate (the satellite overrides below) or accepts one as a
 * parameter takes this instead. The keys still come from `plateForScheme`, so a role added there
 * is a role required here.
 */
export type MapPlate = { readonly [K in keyof ReturnType<typeof plateForScheme>]: string };

/* ---------------------------------------------------------------------------------------------
 * Satellite contrast
 *
 * The plate's ink was contrast-held against two flat fills (`land`, `water`) — that is what
 * design law §3's ΔL* contract measures against, and `map-contrast.test.ts` enforces. Aerial
 * imagery has no such fill: one label can cross a white roof, a black shadow and a green field
 * inside its own bounding box, so no ink color is safe against it on its own.
 *
 * Two mechanisms, in this order:
 *
 * 1. Knock the imagery back before anything is drawn on it. The raster layer sits ABOVE the
 *    existing `background` layer and is deliberately not opaque, so the plate color underneath
 *    shows through as a scrim: on dark it pulls the imagery toward the archive's near-black, on
 *    light toward white. That compresses the imagery's luminance range from both ends, which is
 *    what makes a fixed ink color viable at all. Desaturating does the same job in the color
 *    channel and buys something else besides — kind shade is an ENCODING channel on this map, and
 *    a fully saturated aerial competes with the copper pins for the eye.
 *
 * 2. Re-ink the cartography for what is left, and widen every halo. Overrides below, per scheme.
 * ------------------------------------------------------------------------------------------- */

/**
 * Raster paint for the imagery layer. Tuned per scheme — see `plateOverImagery`.
 *
 * Both schemes declare every channel, including the ones they leave at the MapLibre default.
 * A theme toggle re-pushes this table onto a layer that is already mounted (`syncSingleLayerPaint`
 * sets only the keys the new style names), so a channel present in one scheme and absent in the
 * other would survive the switch and darken the light plate with the dark plate's ceiling.
 */
export const SATELLITE_RASTER_PAINT = {
  light: {
    // Lower opacity on light: the white beneath has to lift the imagery far enough that the
    // plate's dark ink still clears it, and shadowed terrain is what threatens legibility here.
    'raster-opacity': 0.62,
    'raster-saturation': -0.32,
    'raster-contrast': -0.12,
    // Lifts the deepest shadows, which is where black ink would otherwise disappear.
    'raster-brightness-min': 0.18,
    'raster-brightness-max': 1,
  },
  dark: {
    'raster-opacity': 0.76,
    'raster-saturation': -0.28,
    'raster-contrast': -0.08,
    'raster-brightness-min': 0,
    // Caps snow, sand and bare roofs, which are what blow out under paper-coloured labels.
    'raster-brightness-max': 0.88,
  },
} as const;

/**
 * Halo width for symbol layers over imagery. The plate's own 1–1.5px halo is sized for a flat
 * fill; over aerial texture it leaves the label chewed at the edges.
 */
export const SATELLITE_HALO_WIDTH = 2.2;

/**
 * Presence/choropleth fill opacity while imagery is on.
 *
 * The flat-plate value (`PLATE_STATE_FILL_OPACITY`, 0.82) is nearly opaque — correct over a flat
 * plate and self-defeating over imagery: turning satellite on and getting a wash of density tint
 * is not satellite. Low enough to read the ground through, high enough to keep the tier ramp
 * ordered.
 */
export const SATELLITE_STATE_FILL_OPACITY = 0.45;

/**
 * Plate ink re-tuned for the scrimmed imagery.
 *
 * Only cartography ink moves. Pin, cluster and density encoding are untouched: they are the
 * archive's data, they already sit above everything, and changing them by basemap would mean the
 * same record read as a different colour depending on a toggle.
 */
export function plateOverImagery(scheme: MapColorScheme): MapPlate {
  const base = plateForScheme(scheme);
  if (scheme === 'light') {
    return {
      ...base,
      // Imagery is lifted toward white, so ink stays dark — but goes to full black rather than
      // the plate's softer greys, which disappear into mid-tone terrain.
      placeLabel: brandPalette.blackInk,
      placeLabelHi: brandPalette.blackInk,
      placeLabelHalo: LIGHT_PLATE_OCEAN,
      streetLabel: brandPalette.blackInk,
      countyLabel: brandPalette.blackInk,
      countyLabelHalo: LIGHT_PLATE_OCEAN,
      // Boundaries have no halo to hide behind, so they carry their own contrast.
      countryBounds: brandPalette.blackInk,
      stateBounds: brandPalette.blackInk,
      countyLine: brandPalette.blackInk,
      clusterText: brandPalette.blackInk,
    } as const;
  }
  return {
    ...base,
    placeLabel: brandPalette.archivePaper,
    placeLabelHi: brandPalette.archivePaper,
    placeLabelHalo: brandPalette.blackInk,
    streetLabel: brandPalette.archivePaper,
    countyLabel: brandPalette.archivePaper,
    countyLabelHalo: brandPalette.blackInk,
    countryBounds: brandPalette.archivePaper,
    stateBounds: brandPalette.archivePaper,
    countyLine: brandPalette.archivePaper,
    clusterText: brandPalette.archivePaper,
  } as const;
}

/** The plate a style should paint with, given the basemap the reader chose. */
export function plateFor(scheme: MapColorScheme, satellite: boolean): MapPlate {
  return satellite ? plateOverImagery(scheme) : plateForScheme(scheme);
}
