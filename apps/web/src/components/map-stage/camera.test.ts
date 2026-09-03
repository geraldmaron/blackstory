/**
 * The camera attitude half of `runFlyPreset` (repo-lk7p8).
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
import { runFlyPreset } from './camera';

type Call = Record<string, unknown>;

/** The three camera entry points `runFlyPreset` can take, recorded rather than executed. */
function fakeMap() {
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
      cameraForBounds: () => ({ center: { lng: -96.5, lat: 38.6 }, zoom: 3.35 }),
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
