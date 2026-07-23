/**
 * Marker radius + zoom scale parity with web `marker-size.ts`.
 */
import {
  MARKER_RADIUS_MAX,
  MARKER_RADIUS_MIN,
  MARKER_ZOOM_SCALE_STOPS,
  markerRadius,
  markerRadiusAtZoom,
  markerRadiusExpression,
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
