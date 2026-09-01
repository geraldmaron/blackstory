/**
 * MapLibre paint helpers that mirror the Door / first-paint pin plate (Page Sand
 * record discs, copper holding walks). Kind-encoded coloring is blended in from
 * explore-style.ts past locality zoom so the instrument Color key still applies
 * when readers zoom in.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { brandPalette } from '@repo/ui';
import { markerRadiusExpression } from './marker-size';

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

export function blendFirstPaintWithKindExpression(
  kindExpression: ExpressionSpecification,
  firstPaintExpression: ExpressionSpecification,
): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    FIRST_PAINT_MAP_MAX_ZOOM,
    firstPaintExpression,
    FIRST_PAINT_MAP_MAX_ZOOM + 0.001,
    kindExpression,
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
  return blendFirstPaintWithKindExpression(localityStroke, 0);
}
