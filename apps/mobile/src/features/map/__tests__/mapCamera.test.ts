/**
 * Pure camera/viewport geometry tests (MOB-012). No native map is involved.
 */
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  US_BOUNDS,
  US_CAMERA_BOUNDS_PAD_DEG,
  US_CAMERA_MAX_BOUNDS,
  boundsForCoordinates,
  cameraForPreset,
  cameraMotion,
  clampZoom,
  coordinateDecimals,
  coarsestDecimals,
  coarsenTo,
  isInBounds,
  isNoMorePreciseThan,
  padBounds,
  type LngLat,
} from '../mapCamera';

describe('isInBounds', () => {
  const bbox = { west: -100, south: 30, east: -80, north: 40 };
  it('includes points inside and on the edge', () => {
    expect(isInBounds([-90, 35], bbox)).toBe(true);
    expect(isInBounds([-100, 30], bbox)).toBe(true);
  });
  it('excludes points outside', () => {
    expect(isInBounds([-79, 35], bbox)).toBe(false);
    expect(isInBounds([-90, 41], bbox)).toBe(false);
  });
});

describe('boundsForCoordinates', () => {
  it('returns the US default for an empty set', () => {
    expect(boundsForCoordinates([])).toEqual(US_BOUNDS);
  });
  it('returns the tight envelope of the inputs (never invents a corner)', () => {
    const coords: LngLat[] = [
      [-77.04, 38.9],
      [-95.37, 29.76],
    ];
    const [w, s, e, n] = boundsForCoordinates(coords);
    expect(w).toBe(-95.37);
    expect(e).toBe(-77.04);
    expect(s).toBe(29.76);
    expect(n).toBe(38.9);
  });
});

describe('padBounds / US_CAMERA_MAX_BOUNDS', () => {
  it('pads each edge by the requested degrees', () => {
    expect(padBounds([-100, 30, -80, 40], 2)).toEqual([-102, 28, -78, 42]);
  });

  it('treats non-finite pad as zero', () => {
    expect(padBounds(US_BOUNDS, Number.NaN)).toEqual(US_BOUNDS);
  });

  it('derives CONUS maxBounds from US_BOUNDS with a small pad (not free-world)', () => {
    expect(US_CAMERA_MAX_BOUNDS).toEqual(padBounds(US_BOUNDS, US_CAMERA_BOUNDS_PAD_DEG));
    expect(US_CAMERA_MAX_BOUNDS[0]).toBeLessThan(US_BOUNDS[0]);
    expect(US_CAMERA_MAX_BOUNDS[2]).toBeGreaterThan(US_BOUNDS[2]);
    // Still a continental envelope — never global.
    expect(US_CAMERA_MAX_BOUNDS[0]).toBeGreaterThan(-140);
    expect(US_CAMERA_MAX_BOUNDS[2]).toBeLessThan(-50);
    expect(MAP_MIN_ZOOM).toBeGreaterThanOrEqual(3);
    expect(MAP_MIN_ZOOM).toBeLessThanOrEqual(MAP_MAX_ZOOM);
  });
});

describe('cameraForPreset', () => {
  it('national frames the US', () => {
    expect(cameraForPreset('national')).toEqual({ kind: 'bounds', bounds: US_BOUNDS });
  });

  it('point centers on the coordinate at the zoom ceiling — never beyond it', () => {
    const target = cameraForPreset('point', { point: [-95.37, 29.76] });
    expect(target).toEqual({ kind: 'center', center: [-95.37, 29.76], zoom: MAP_MAX_ZOOM });
    if (target.kind === 'center') expect(target.zoom).toBeLessThanOrEqual(MAP_MAX_ZOOM);
  });

  it('state/locality frame the envelope of multiple coordinates', () => {
    const coords: LngLat[] = [
      [-77.04, 38.9],
      [-73.79, 40.72],
    ];
    const target = cameraForPreset('state', { coordinates: coords });
    expect(target.kind).toBe('bounds');
  });

  it('never emits a zoom above MAP_MAX_ZOOM for any preset', () => {
    for (const preset of ['national', 'state', 'locality', 'point'] as const) {
      const target = cameraForPreset(preset, { point: [-95.37, 29.76], coordinates: [[-95.37, 29.76]] });
      if (target.kind === 'center') expect(target.zoom).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    }
  });
});

describe('clampZoom', () => {
  it('clamps above the ceiling and below zero', () => {
    expect(clampZoom(99)).toBe(MAP_MAX_ZOOM);
    expect(clampZoom(-5)).toBe(0);
    expect(clampZoom(Number.NaN)).toBe(0);
  });
});

describe('cameraMotion (reduced motion)', () => {
  it('collapses duration to 0 when reduced motion is on', () => {
    expect(cameraMotion('point', true).durationMs).toBe(0);
    expect(cameraMotion('national', true).durationMs).toBe(0);
  });
  it('uses a non-zero token duration when motion is allowed', () => {
    expect(cameraMotion('point', false).durationMs).toBeGreaterThan(0);
    expect(cameraMotion('national', false).durationMs).toBeGreaterThan(0);
  });
});

describe('precision guards (de-redaction defense)', () => {
  it('counts decimal places and finds the coarsest', () => {
    expect(coordinateDecimals([-95.37, 29.76])).toBe(2);
    expect(coordinateDecimals([-95.369803, 29.76])).toBe(6);
    expect(coarsestDecimals([[-95.37, 29.76], [-95.369803, 29.760427]])).toBe(2);
  });

  it('flags a derived point that is MORE precise than the coarsest input', () => {
    const sources: LngLat[] = [[-95.37, 29.76], [-77.04, 38.9]];
    expect(isNoMorePreciseThan([-86.205, 34.33], sources)).toBe(false); // 3 dp > 2 dp
    expect(isNoMorePreciseThan([-86.2, 34.3], sources)).toBe(true);
  });

  it('coarsens only ever reduces precision', () => {
    expect(coarsenTo([-86.205123, 34.339], 2)).toEqual([-86.21, 34.34]);
  });
});
