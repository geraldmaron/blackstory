/**
 * MapLibre paint helpers that mirror the Door / first-paint pin plate (Page Sand
 * record discs, copper holding walks). Kind-encoded coloring is blended in from
 * explore-style.ts past locality zoom so the instrument Color key still applies
 * when readers zoom in.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { brandPalette } from '@repo/ui';

/** Zoom at and below which entity discs match the first-paint national field. */
export const FIRST_PAINT_MAP_MAX_ZOOM = 12;

/** GL entity discs hide at this zoom; HTML first-paint hit targets mount above cluster max. */
export const EXPLORE_GL_ENTITY_MAX_ZOOM = FIRST_PAINT_MAP_MAX_ZOOM + 0.001;

/** CSS `0.4375rem` at 16px root — record disc radius on the national field. */
export const FIRST_PAINT_RECORD_RADIUS_PX = 3.5;

/** CSS `0.5625rem` at 16px root — holding walk disc radius. */
export const FIRST_PAINT_WALK_RADIUS_PX = 4.5;

/** Solid Page Sand — Archive Paper read as white and vanished on the dark plate. */
export const FIRST_PAINT_RECORD_FILL_OPACITY = 1;

/** Holding walks use solid graphic copper like `--ds-accent-graphic`. */
export const FIRST_PAINT_WALK_FILL_OPACITY = 1;

/** MapLibre: true when the feature is an allowlisted atlas walk (same rule as Door `holdingWalk`). */
export function holdingPlaceWalkExpression(): ExpressionSpecification {
  return ['==', ['get', 'holdingWalk'], true] as unknown as ExpressionSpecification;
}

function firstPaintRecordColor(): string {
  return brandPalette.pageSand;
}

function firstPaintWalkColor(): string {
  return brandPalette.copperPin;
}

/** Page Sand records vs copper walks — majority pins must not use Archive Paper (white). */
export function firstPaintPointColorExpression(): ExpressionSpecification {
  return [
    'case',
    holdingPlaceWalkExpression(),
    firstPaintWalkColor(),
    firstPaintRecordColor(),
  ] as unknown as ExpressionSpecification;
}

export function firstPaintPointOpacityExpression(): ExpressionSpecification {
  return [
    'case',
    holdingPlaceWalkExpression(),
    FIRST_PAINT_WALK_FILL_OPACITY,
    FIRST_PAINT_RECORD_FILL_OPACITY,
  ] as unknown as ExpressionSpecification;
}

export function firstPaintPointRadiusExpression(): ExpressionSpecification {
  return [
    'case',
    holdingPlaceWalkExpression(),
    FIRST_PAINT_WALK_RADIUS_PX,
    FIRST_PAINT_RECORD_RADIUS_PX,
  ] as unknown as ExpressionSpecification;
}

/** MapLibre literal for numeric paint slots in first-paint blends. */
export function literalPaintNumber(value: number): ExpressionSpecification {
  return ['literal', value] as unknown as ExpressionSpecification;
}

/** `[zoom, output]` pairs when `expression` is a top-level `['interpolate', ..., ['zoom'], …]`. */
function topLevelZoomStops(expression: unknown): readonly (readonly [number, unknown])[] | null {
  if (!Array.isArray(expression) || expression[0] !== 'interpolate') return null;
  const input = expression[2];
  if (!Array.isArray(input) || input.length !== 1 || input[0] !== 'zoom') return null;
  const stops: (readonly [number, unknown])[] = [];
  for (let i = 3; i + 1 < expression.length; i += 2) {
    const zoom = expression[i];
    if (typeof zoom !== 'number') return null;
    stops.push([zoom, expression[i + 1]]);
  }
  return stops;
}

/**
 * One top-level zoom interpolate: the first-paint value through the national field, the kind
 * value past it.
 *
 * MapLibre allows exactly one zoom-driven `interpolate`/`step` per paint expression, and it must
 * be the outermost one. `marker-size.ts` already builds radius and stroke width as top-level zoom
 * interpolates (county-proportionate scaling), so wrapping those in a second zoom interpolate was
 * rejected at `addLayer` with "Only one zoom-based step or interpolate subexpression may be used".
 * That rejection is silent to the reader: the style never applies, the plate never stamps
 * `data-plate-ready`, the Albers underlay stays up and the Atlas reads as the Door with the
 * instruments floating over a static pin field. So a zoom-scaled kind expression is folded here:
 * its stops are spliced into this interpolate after the handoff zoom, and its value AT the
 * handoff is the last stop at or below it (MapLibre's own flat extrapolation past a final stop —
 * `MARKER_ZOOM_SCALE_STOPS` ends at the handoff, which `first-paint-map-paint.test.ts` pins).
 */
export function blendFirstPaintWithKindExpression(
  kindExpression: ExpressionSpecification,
  firstPaintExpression: ExpressionSpecification,
): ExpressionSpecification {
  const handoffZoom = FIRST_PAINT_MAP_MAX_ZOOM + 0.001;
  const kindStops = topLevelZoomStops(kindExpression);
  if (kindStops === null) {
    return [
      'interpolate',
      ['linear'],
      ['zoom'],
      FIRST_PAINT_MAP_MAX_ZOOM,
      firstPaintExpression,
      handoffZoom,
      kindExpression,
    ] as unknown as ExpressionSpecification;
  }
  const atOrBelow = kindStops.filter(([zoom]) => zoom <= handoffZoom);
  const beyond = kindStops.filter(([zoom]) => zoom > handoffZoom);
  const kindAtHandoff = (atOrBelow[atOrBelow.length - 1] ?? kindStops[0])?.[1];
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    FIRST_PAINT_MAP_MAX_ZOOM,
    firstPaintExpression,
    handoffZoom,
    kindAtHandoff,
    ...beyond.flatMap(([zoom, output]) => [zoom, output]),
  ] as unknown as ExpressionSpecification;
}

export function firstPaintOrKindRadiusExpression(
  kindRadiusExpression: ExpressionSpecification,
): ExpressionSpecification {
  return blendFirstPaintWithKindExpression(kindRadiusExpression, firstPaintPointRadiusExpression());
}

/** No kind rim on the national field; locality uses kind stroke signatures. */
export function firstPaintOrKindStrokeWidthExpression(
  localityStroke: ExpressionSpecification,
): ExpressionSpecification {
  return blendFirstPaintWithKindExpression(localityStroke, literalPaintNumber(0));
}
