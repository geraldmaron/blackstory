/**
 * Entity paint + selection hierarchy for the native Explore plate.
 */
import {
  ENTITY_CLUSTER_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
  ENTITY_SELECTED_INNER_LAYER_STYLE,
  ENTITY_SELECTED_LAYER_STYLE,
  ENTITY_SELECTED_RADIUS_OFFSET,
  ENTITY_SELECTED_PULSE_OPACITY_FROM,
  ENTITY_SELECTED_PULSE_OPACITY_TO,
  ENTITY_SELECTED_PULSE_SCALE_FROM,
  ENTITY_SELECTED_PULSE_SCALE_TO,
  ENTITY_SELECTED_PULSE_STATIC_OPACITY,
  ENTITY_SELECTED_PULSE_STATIC_SCALE,
  entitySelectedPulseLayerStyle,
  entitySelectedPulseStaticLayerStyle,
  pulseEaseInOut,
} from '../entity-paint';
import { DIGNITY_PALETTE } from '../dignity-palette';
import { MARKER_ZOOM_SCALE_STOPS } from '../marker-size';

describe('entity paint hierarchy', () => {
  it('keeps unclustered fills readable on the dark plate without going fully opaque', () => {
    expect(ENTITY_POINT_FILL_OPACITY).toBeGreaterThanOrEqual(0.6);
    expect(ENTITY_POINT_FILL_OPACITY).toBeLessThan(1);
    expect(ENTITY_CLUSTER_OPACITY).toBeGreaterThan(ENTITY_POINT_FILL_OPACITY);
  });

  it('selected outer ring is copper accent with a larger radius offset than the inner paper ring', () => {
    expect(ENTITY_SELECTED_LAYER_STYLE.circleStrokeColor).toBe(DIGNITY_PALETTE.selectedAccent);
    expect(ENTITY_SELECTED_INNER_LAYER_STYLE.circleStrokeColor).toBe(DIGNITY_PALETTE.selected);
    expect(ENTITY_SELECTED_RADIUS_OFFSET).toBeGreaterThan(3);
    expect(JSON.stringify(ENTITY_SELECTED_LAYER_STYLE.circleRadius)).toContain(
      String(ENTITY_SELECTED_RADIUS_OFFSET),
    );
  });
});

describe('selected pulse ring', () => {
  it('eases monotonically from 0 to 1 across the loop', () => {
    expect(pulseEaseInOut(0)).toBe(0);
    expect(pulseEaseInOut(1)).toBeCloseTo(1);
    expect(pulseEaseInOut(0.5)).toBeCloseTo(0.5);
    expect(pulseEaseInOut(0.25)).toBeLessThan(pulseEaseInOut(0.5));
    expect(pulseEaseInOut(0.5)).toBeLessThan(pulseEaseInOut(0.75));
  });

  it('scales the ring up and fades it out as progress advances (copper accent, single feature)', () => {
    const start = entitySelectedPulseLayerStyle(0) as {
      circleRadius: readonly unknown[];
      circleStrokeColor: string;
      circleStrokeOpacity: number;
    };
    const end = entitySelectedPulseLayerStyle(1) as {
      circleRadius: readonly unknown[];
      circleStrokeColor: string;
      circleStrokeOpacity: number;
    };

    expect(start.circleStrokeColor).toBe(DIGNITY_PALETTE.selectedAccent);
    expect(start.circleStrokeOpacity).toBeCloseTo(ENTITY_SELECTED_PULSE_OPACITY_FROM);
    expect(end.circleStrokeOpacity).toBeCloseTo(ENTITY_SELECTED_PULSE_OPACITY_TO);
    expect(end.circleStrokeOpacity).toBeLessThan(start.circleStrokeOpacity);

    // The pulse's scale-over-time factor is baked into EACH zoom stop (not
    // multiplied onto the finished zoom `interpolate` afterward) — MapLibre
    // requires a `["zoom"]` read to be the input of a TOP-LEVEL
    // interpolate/step; this is a regression guard for the exact native crash
    // ("zoom expression may only be used as input to a top-level interpolate
    // or step expression") a naive `['*', <zoom expr>, scale]` would throw.
    expect(start.circleRadius[0]).toBe('interpolate');
    expect(start.circleRadius[2]).toEqual(['zoom']);
    const startJson = JSON.stringify(start.circleRadius);
    const endJson = JSON.stringify(end.circleRadius);
    for (const [, zoomScale] of MARKER_ZOOM_SCALE_STOPS) {
      expect(startJson).toContain(String(zoomScale * ENTITY_SELECTED_PULSE_SCALE_FROM));
      expect(endJson).toContain(String(zoomScale * ENTITY_SELECTED_PULSE_SCALE_TO));
    }
  });

  it('renders a fixed, enlarged, non-animating ring under reduced motion', () => {
    const staticStyle = entitySelectedPulseStaticLayerStyle() as {
      circleRadius: readonly unknown[];
      circleStrokeColor: string;
      circleStrokeOpacity: number;
    };
    expect(staticStyle.circleStrokeColor).toBe(DIGNITY_PALETTE.selectedAccent);
    expect(staticStyle.circleStrokeOpacity).toBe(ENTITY_SELECTED_PULSE_STATIC_OPACITY);
    expect(staticStyle.circleRadius[0]).toBe('interpolate');
    const staticJson = JSON.stringify(staticStyle.circleRadius);
    for (const [, zoomScale] of MARKER_ZOOM_SCALE_STOPS) {
      expect(staticJson).toContain(String(zoomScale * ENTITY_SELECTED_PULSE_STATIC_SCALE));
    }
  });
});
