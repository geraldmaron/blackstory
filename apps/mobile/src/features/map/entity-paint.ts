/**
 * MapLibre entity circle paint expressions for native Explore.
 * Mirrors web `explore-style.ts` unclustered + cluster layers — kind shade,
 * glyph rim signatures, evidence-based radius. No crime-heatmap ramps.
 */
import {
  DEFAULT_KIND_ENCODING,
  KIND_ENCODING_ENTRIES,
  KIND_FAMILY_ENTRIES,
  MAP_SEMANTIC_TONE_ENCODING,
} from './kind-encoding';
import { DIGNITY_PALETTE } from './dignity-palette';
import { markerRadiusExpression, markerRadiusPlusExpression, MARKER_HALO_OFFSET } from './marker-size';

type KindGlyphPaintSignature = {
  readonly opacity: number;
  readonly strokeWidth: number;
  readonly strokeColor: string;
};

export const ENTITY_POINT_FILL_OPACITY = 0.52;
export const ENTITY_HALO_OPACITY = 0.16;
export const ENTITY_CLUSTER_OPACITY = 0.55;
export const ENTITY_RING_FILL_OPACITY = 0.2;

const GLYPH_PAINT_SIGNATURE: Readonly<Record<string, KindGlyphPaintSignature>> = {
  circle: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 1.5,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  square: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 4,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  diamond: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 1.5,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  ring: {
    opacity: ENTITY_RING_FILL_OPACITY,
    strokeWidth: 3,
    strokeColor: DIGNITY_PALETTE.kindInstitutionStroke,
  },
};

const DEFAULT_GLYPH_PAINT_SIGNATURE: KindGlyphPaintSignature = GLYPH_PAINT_SIGNATURE.circle!;

function glyphSignatureFor(glyph: string): KindGlyphPaintSignature {
  return GLYPH_PAINT_SIGNATURE[glyph] ?? DEFAULT_GLYPH_PAINT_SIGNATURE;
}

function kindMatchExpression(
  valueForEntry: (entry: (typeof KIND_ENCODING_ENTRIES)[number][1]) => string | number,
  fallback: string | number,
): readonly unknown[] {
  const cases = KIND_ENCODING_ENTRIES.flatMap(([kind, entry]) => [kind, valueForEntry(entry)]);
  return ['match', ['get', 'kind'], ...cases, fallback] as const;
}

/** Kind-family shade from denormalized `shade` or tone/kind fallbacks. */
export function kindColorExpression(): readonly unknown[] {
  const semanticCases = Object.entries(MAP_SEMANTIC_TONE_ENCODING).flatMap(([tone, entry]) => [
    tone,
    entry.shade,
  ]);
  const kindCases = KIND_FAMILY_ENTRIES.flatMap(([family, entry]) => [family, entry.shade]);
  return [
    'case',
    ['has', 'shade'],
    ['get', 'shade'],
    ['has', 'mapTone'],
    ['match', ['get', 'mapTone'], ...semanticCases, DEFAULT_KIND_ENCODING.shade],
    [
      'match',
      ['coalesce', ['get', 'kindFamily'], ['get', 'kind']],
      ...kindCases,
      DEFAULT_KIND_ENCODING.shade,
    ],
  ] as const;
}

export function kindFillOpacityExpression(): readonly unknown[] {
  return kindMatchExpression(
    (entry) => glyphSignatureFor(entry.glyph).opacity,
    DEFAULT_GLYPH_PAINT_SIGNATURE.opacity,
  );
}

export function kindStrokeWidthExpression(): readonly unknown[] {
  return kindMatchExpression(
    (entry) => glyphSignatureFor(entry.glyph).strokeWidth,
    DEFAULT_GLYPH_PAINT_SIGNATURE.strokeWidth,
  );
}

export function kindStrokeColorExpression(rimColor: string): readonly unknown[] {
  return kindMatchExpression(
    (entry) => (entry.glyph === 'ring' ? DIGNITY_PALETTE.kindInstitutionStroke : rimColor),
    rimColor,
  );
}

export const ENTITY_POINT_LAYER_STYLE = {
  circleColor: kindColorExpression(),
  circleRadius: markerRadiusExpression(),
  circleOpacity: kindFillOpacityExpression(),
  circleStrokeColor: kindStrokeColorExpression(DIGNITY_PALETTE.selected),
  circleStrokeWidth: kindStrokeWidthExpression(),
} as const;

export const ENTITY_HALO_LAYER_STYLE = {
  circleColor: kindColorExpression(),
  circleRadius: markerRadiusPlusExpression(MARKER_HALO_OFFSET),
  circleOpacity: ENTITY_HALO_OPACITY,
  circleStrokeWidth: 0,
} as const;

export const ENTITY_EVENT_GLYPH_LAYER_STYLE = {
  circleColor: kindColorExpression(),
  circleRadius: markerRadiusPlusExpression(4),
  circleOpacity: 0,
  circleStrokeColor: kindColorExpression(),
  circleStrokeWidth: 1.5,
  circleStrokeOpacity: 0.9,
} as const;

export const ENTITY_SELECTED_LAYER_STYLE = {
  circleColor: 'transparent',
  circleRadius: markerRadiusPlusExpression(3),
  circleStrokeColor: DIGNITY_PALETTE.selected,
  circleStrokeWidth: 2,
} as const;

export const ENTITY_CLUSTER_LAYER_STYLE = {
  circleColor: DIGNITY_PALETTE.point,
  circleOpacity: ENTITY_CLUSTER_OPACITY,
  circleStrokeColor: DIGNITY_PALETTE.selected,
  circleStrokeWidth: 2,
} as const;
