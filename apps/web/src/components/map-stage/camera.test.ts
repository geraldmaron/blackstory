/**
 * The camera attitude half of `runFlyPreset`.
 *
 * The defect these lock down is a one-way scroll: the Door's tilted chapters set pitch and
 * bearing through `flyTo`, but its flat national chapters frame CONUS through the `national`
 * preset, and a preset that names only center and zoom leaves MapLibre holding whatever attitude
 * the camera arrived with. Scrolling forward tilted the field and scrolling back up left it
 * tilted. Passing the authored attitude through the preset is what makes the journey reversible,
 * so it is asserted here rather than left to the caller to remember.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAP_MIN_ZOOM } from '../../lib/map-experience/camera-presets';
import { fitBoundsCamera, runFlyPreset } from './camera';

type Call = Record<string, unknown>;

/** The three camera entry points `runFlyPreset` can take, recorded rather than executed. */
function fakeMap(fitZoom = 3.35) {
  const calls: { readonly kind: string; readonly options: Call }[] = [];
  const record = (kind: string) => (options: Call) => {
    calls.push({ kind, options });
  };
  return {
    calls,
    map: {
      easeTo: record('easeTo'),
      flyTo: record('flyTo'),
      jumpTo: record('jumpTo'),
      setMinZoom: (value: number) => {
        calls.push({ kind: 'setMinZoom', options: { value } });
      },
      cameraForBounds: () => ({ center: { lng: -96.5, lat: 38.6 }, zoom: fitZoom }),
      getZoom: () => fitZoom,
      getCenter: () => ({ lng: -96.5, lat: 38.6 }),
      getContainer: () => ({ clientWidth: 1000 }),
    },
  };
}

const CONUS = [-125, 24, -66, 50] as const;

test('an authored attitude reaches the camera on every preset path', () => {
  for (const [mode, kind] of [
    ['ease', 'easeTo'],
    ['fly', 'flyTo'],
  ] as const) {
    const { calls, map } = fakeMap();
    assert.equal(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runFlyPreset(map as any, 'national', { bounds: CONUS }, { mode, pitch: 0, bearing: 0 }),
      true,
    );
    assert.equal(calls[0]?.kind, kind);
    assert.equal(calls[0]?.options.pitch, 0);
    assert.equal(calls[0]?.options.bearing, 0);
  }
});

test('an omitted attitude is left alone, so a hand-turned plate keeps its own bearing', () => {
  const { calls, map } = fakeMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runFlyPreset(map as any, 'national', { center: [-96.5, 38.6], zoom: 3.35 });
  assert.equal(calls[0]?.kind, 'flyTo');
  assert.equal('pitch' in (calls[0]?.options ?? {}), false);
  assert.equal('bearing' in (calls[0]?.options ?? {}), false);
});

test('a cut lands the preset frame in one step, with its attitude', () => {
  const { calls, map } = fakeMap();
  assert.equal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runFlyPreset(map as any, 'national', { bounds: CONUS }, { mode: 'cut', pitch: 0, bearing: 0 }),
    true,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.kind, 'jumpTo');
  assert.equal(calls[0]?.options.pitch, 0);
  assert.equal(calls[0]?.options.bearing, 0);
  // A bounds fit bakes its padding into center/zoom; the transform's own padding stays clear.
  assert.deepEqual(calls[0]?.options.padding, { top: 0, bottom: 0, left: 0, right: 0 });
});

test('a fit may sink the zoom floor to what the frame needs, and only that far', () => {
  const below = fakeMap(2.2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runFlyPreset(below.map as any, 'national', { bounds: CONUS }, { mode: 'cut', zoomFloor: 'fit' });
  assert.deepEqual(below.calls.find((call) => call.kind === 'setMinZoom')?.options, { value: 2.2 });
  assert.equal(below.calls.at(-1)?.kind, 'jumpTo');
  assert.equal(below.calls.at(-1)?.options.zoom, 2.2);

  const above = fakeMap(3.47);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runFlyPreset(above.map as any, 'national', { bounds: CONUS }, { mode: 'cut', zoomFloor: 'fit' });
  assert.deepEqual(above.calls.find((call) => call.kind === 'setMinZoom')?.options, {
    value: MAP_MIN_ZOOM,
  });

  // Without the option a fit never touches the floor, whatever it computed.
  const plain = fakeMap(2.2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runFlyPreset(plain.map as any, 'national', { bounds: CONUS }, { mode: 'cut' });
  assert.equal(
    plain.calls.some((call) => call.kind === 'setMinZoom'),
    false,
  );
});

test('a bounds fit is computed with no padding held on the camera, and the held padding is put back', () => {
  // The defect: a center-and-zoom flight leaves its padding on the camera, MapLibre adds the
  // fit's own padding to it, and the country is fitted into what is left of the screen twice over.
  const held = { top: 84, bottom: 32, left: 585, right: 152 };
  let onCamera = { ...held };
  const seenAtFit: (typeof held)[] = [];
  const { calls, map } = fakeMap();
  const withPadding = {
    ...map,
    transform: {
      get padding() {
        return onCamera;
      },
      setPadding: (next: typeof held) => {
        onCamera = { ...next };
      },
    },
    cameraForBounds: () => {
      seenAtFit.push({ ...onCamera });
      return { center: { lng: -96.5, lat: 38.6 }, zoom: 3.35 };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runFlyPreset(withPadding as any, 'national', { bounds: CONUS }, { mode: 'ease', padding: held });
  assert.deepEqual(seenAtFit, [{ top: 0, bottom: 0, left: 0, right: 0 }]);
  assert.deepEqual(onCamera, held);
  // The fit lands with no padding on the camera: its padding is already in the center and zoom.
  assert.deepEqual(calls.at(-1)?.options.padding, { top: 0, bottom: 0, left: 0, right: 0 });
});

test('a fit MapLibre cannot make is no fit, and the held padding is put back', () => {
  const held = { top: 10, bottom: 20, left: 30, right: 40 };
  let onCamera = { ...held };
  const transform = {
    get padding() {
      return onCamera;
    },
    setPadding: (next: typeof held) => {
      onCamera = { ...next };
    },
  };
  // MapLibre 5.24's globe helper throws when the paddings leave no canvas.
  const throws = {
    transform,
    cameraForBounds: () => {
      throw new TypeError("Cannot read properties of undefined (reading 'center')");
    },
  };
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal(fitBoundsCamera(throws, CONUS, 48), undefined);
  } finally {
    console.error = error;
  }
  assert.deepEqual(onCamera, held);
  // A map with no size yet fits to a non-finite zoom.
  assert.equal(fitBoundsCamera({ cameraForBounds: () => ({ zoom: NaN }) }, CONUS, 48), undefined);
  assert.deepEqual(fitBoundsCamera({ cameraForBounds: () => ({ zoom: 4 }) }, CONUS, undefined), {
    center: undefined,
    zoom: 4,
  });
});
