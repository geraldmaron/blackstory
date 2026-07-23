/**
 * Marker radius + zoom scale parity with web `marker-size.ts`.
 */
import {
  MARKER_HALO_OFFSET,
  MARKER_RADIUS_MAX,
  MARKER_RADIUS_MIN,
  MARKER_ZOOM_SCALE_STOPS,
  markerHaloRadiusAtZoom,
  markerRadius,
  markerRadiusAtZoom,
  markerRadiusExpression,
  markerRadiusPlusExpression,
  markerStrokeWidthAtZoom,
  markerZoomScale,
} from '../marker-size';

describe('markerRadius', () => {
  it('clamps to MIN/MAX at zero and high evidence', () => {
    expect(markerRadius(0, 'high')).toBe(MARKER_RADIUS_MIN);
    expect(markerRadius(256, 'high')).toBe(MARKER_RADIUS_MAX);
  });

  it('applies confidence modifier as secondary signal', () => {
    expect(markerRadius(4, 'low')).toBeLessThan(markerRadius(4, 'high'));
  });
});

describe('markerZoomScale', () => {
  it('shrinks at national zoom and grows at locality', () => {
    expect(markerZoomScale(3)).toBe(MARKER_ZOOM_SCALE_STOPS[0]![1]);
    expect(markerZoomScale(5.5)).toBe(MARKER_ZOOM_SCALE_STOPS[1]![1]);
    expect(markerZoomScale(9)).toBeGreaterThan(markerZoomScale(3));
  });
});

describe('markerRadiusAtZoom', () => {
  it('national pins are smaller than locality pins for same record', () => {
    const national = markerRadiusAtZoom(8, 'high', 3.8);
    const locality = markerRadiusAtZoom(8, 'high', 10);
    expect(national).toBeLessThan(locality);
    expect(national).toBeGreaterThanOrEqual(MARKER_RADIUS_MIN * markerZoomScale(3.8) * 0.99);
  });
});

describe('markerRadiusExpression', () => {
  it('uses top-level zoom interpolate (MapLibre paint contract)', () => {
    const expr = markerRadiusExpression();
    expect(expr[0]).toBe('interpolate');
    expect(expr[2]).toEqual(['zoom']);
  });
});

describe('national halo / stroke scale', () => {
  it('scales halo offset with zoom so national pins are not rim-dominated', () => {
    const fill = markerRadiusAtZoom(8, 'high', 3);
    const halo = markerHaloRadiusAtZoom(8, 'high', 3);
    expect(halo - fill).toBeCloseTo(MARKER_HALO_OFFSET * markerZoomScale(3));
    expect(halo - fill).toBeLessThan(MARKER_HALO_OFFSET);
  });

  it('scales stroke width with the same zoom stops', () => {
    expect(markerStrokeWidthAtZoom(1.5, 3)).toBeCloseTo(1.5 * markerZoomScale(3));
  });

  it('halo paint expression multiplies (radius + offset) by zoom scale', () => {
    const expr = markerRadiusPlusExpression(MARKER_HALO_OFFSET);
    expect(expr[0]).toBe('interpolate');
    expect(expr[2]).toEqual(['zoom']);
    const firstOut = expr[4] as unknown[];
    expect(firstOut[0]).toBe('*');
    expect(Array.isArray(firstOut[1])).toBe(true);
    expect((firstOut[1] as unknown[])[0]).toBe('+');
    expect((firstOut[1] as unknown[])[2]).toBe(MARKER_HALO_OFFSET);
  });
});
