/**
 * Camera move contracts, exercised against a recording fake map.
 *
 * The assertions that matter most are the ones a reviewer cannot eyeball: that `curve` is 1.42 on
 * every single `flyTo`, that a throwing `fitBounds` degrades instead of taking the map down, that
 * reduced motion reaches zero on every duration, and that `essential` is set only on moves the
 * reader asked for.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CAMERA_FALLBACK_CENTER,
  CAMERA_FALLBACK_ZOOM,
  CAMERA_FLY_CURVE,
  createCamera,
  type CameraAnimationOptions,
  type CameraApi,
  type CameraDeps,
  type MapLike,
  type SpotlightTarget,
} from './camera-moves';

type Call = {
  readonly method: 'flyTo' | 'easeTo' | 'fitBounds';
  readonly options: CameraAnimationOptions;
};

type Harness = {
  readonly camera: CameraApi;
  readonly calls: Call[];
  readonly announcements: string[];
  readonly spotlights: SpotlightTarget[];
  readonly routes: boolean[];
  readonly map: MapLike;
  runPending(): void;
  stopped(): number;
};

function harness(
  overrides: {
    reducedMotion?: boolean;
    fitBoundsThrows?: boolean;
    zoom?: number;
    pitch?: number;
    bearing?: number;
  } = {},
): Harness {
  const calls: Call[] = [];
  const announcements: string[] = [];
  const spotlights: SpotlightTarget[] = [];
  const routes: boolean[] = [];
  let stops = 0;
  let scheduled: (() => void) | null = null;

  const map: MapLike = {
    flyTo(options) {
      calls.push({ method: 'flyTo', options });
    },
    easeTo(options) {
      calls.push({ method: 'easeTo', options });
    },
    fitBounds(_bounds, options) {
      if (overrides.fitBoundsThrows) {
        throw new Error(
          'Map cannot fit within canvas with the given bounds, padding, and/or offset',
        );
      }
      calls.push({ method: 'fitBounds', options });
    },
    getZoom: () => overrides.zoom ?? 4,
    getBearing: () => overrides.bearing ?? 0,
    getPitch: () => overrides.pitch ?? 0,
    getCenter: () => [-90, 35] as const,
    stop() {
      stops += 1;
    },
  };

  const deps: CameraDeps = {
    map,
    padding: () => ({ top: 96, right: 40, bottom: 160, left: 40 }),
    reducedMotion: () => overrides.reducedMotion ?? false,
    announce: (text) => announcements.push(text),
    setSpotlight: (target) => spotlights.push(target),
    setRoutes: (visible) => routes.push(visible),
    scheduler: (callback) => {
      scheduled = callback;
      return 1;
    },
    cancelScheduled: () => {
      scheduled = null;
    },
  };

  return {
    camera: createCamera(deps),
    calls,
    announcements,
    spotlights,
    routes,
    map,
    runPending: () => {
      const run = scheduled;
      scheduled = null;
      run?.();
    },
    stopped: () => stops,
  };
}

/** Runs every move once, for contracts that must hold across the whole vocabulary. */
function exerciseAllMoves(h: Harness): void {
  h.camera.wide();
  h.camera.push();
  h.camera.orbit();
  h.runPending();
  h.camera.tilt();
  h.camera.spotlight();
  h.camera.trace();
  h.camera.flyToRecord({ center: [-86.81, 33.52], place: 'Birmingham, Alabama' });
}

test('every flyTo carries the van Wijk curve', () => {
  const h = harness();
  exerciseAllMoves(h);

  const flights = h.calls.filter((call) => call.method === 'flyTo');
  assert.ok(flights.length > 0, 'the vocabulary must contain at least one flight');
  for (const flight of flights) {
    assert.equal(flight.options.curve, CAMERA_FLY_CURVE, 'curve must never be tuned per call site');
  }
});

test('a throwing fitBounds degrades to an ease instead of killing the map', () => {
  const h = harness({ fitBoundsThrows: true });
  assert.doesNotThrow(() => h.camera.wide());

  const ease = h.calls.find((call) => call.method === 'easeTo');
  assert.ok(ease, 'wide must fall back to easeTo');
  assert.deepEqual(ease.options.center, CAMERA_FALLBACK_CENTER);
  assert.equal(ease.options.zoom, CAMERA_FALLBACK_ZOOM);
  assert.deepEqual(h.announcements, ['Wide · continental'], 'the reader still gets the readout');
});

test('reduced motion collapses every duration to zero', () => {
  const h = harness({ reducedMotion: true, pitch: 0 });
  exerciseAllMoves(h);

  assert.ok(h.calls.length > 0);
  for (const call of h.calls) {
    assert.equal(call.options.duration, 0, `${call.method} must cut under reduced motion`);
  }
});

test('essential marks reader-triggered moves and never ambient ones', () => {
  const reader = harness();
  reader.camera.wide({ trigger: 'reader' });
  reader.camera.flyToRecord(
    { center: [-90, 35], place: 'Jackson, Mississippi' },
    { trigger: 'reader' },
  );
  for (const call of reader.calls) {
    assert.equal(call.options.essential, true);
  }

  const ambient = harness();
  ambient.camera.wide({ trigger: 'ambient' });
  ambient.camera.push({ trigger: 'ambient' });
  ambient.camera.orbit({ trigger: 'ambient' });
  ambient.runPending();
  for (const call of ambient.calls) {
    assert.equal(call.options.essential, false, 'ambient motion must stay suppressible');
  }
});

test('a move defaults to reader-triggered', () => {
  const h = harness();
  h.camera.wide();
  assert.equal(h.calls[0]?.options.essential, true);
});

test('every move announces in the "Move · detail" shape', () => {
  const h = harness();
  exerciseAllMoves(h);

  assert.ok(h.announcements.length >= 7, 'each move reports to the readout');
  for (const text of h.announcements) {
    assert.match(text, /^[^·]+ · .+$/, `"${text}" must read as "Move · detail"`);
    assert.ok(!text.includes('—'), 'copy law bans em dashes');
  }
});

test('wide is the establishing shot and clears any spotlight', () => {
  const h = harness();
  h.camera.spotlight();
  assert.equal(h.camera.isSpotlit(), true);

  h.camera.wide();
  assert.equal(h.camera.isSpotlit(), false);
  assert.deepEqual(h.spotlights.at(-1), null);

  const fit = h.calls.find((call) => call.method === 'fitBounds');
  assert.ok(fit);
  assert.equal(fit.options.pitch, 0, 'the establishing shot is flat');
  assert.equal(fit.options.bearing, 0, 'and north-up');
});

test('push respects the zoom floor and keeps the current bearing', () => {
  const shallow = harness({ zoom: 4, bearing: 30 });
  shallow.camera.push();
  const a = shallow.calls[0]?.options;
  assert.equal(a?.zoom, 8.4, 'a push from far out still clears the floor');
  assert.equal(a?.bearing, 30, 'push does not secretly re-orient the map');

  const deep = harness({ zoom: 9 });
  deep.camera.push();
  assert.equal(deep.calls[0]?.options.zoom, 11.6, 'a push from close in steps by 2.6');
});

test('push accepts an explicit target and labels it', () => {
  const h = harness();
  h.camera.push({ target: [-86.81, 33.52], label: 'Birmingham, Alabama' });
  assert.deepEqual(h.calls[0]?.options.center, [-86.81, 33.52]);
  assert.equal(h.announcements[0], 'Push in · Birmingham, Alabama');
});

test('orbit raises a flat plate first, then rotates linearly', () => {
  const h = harness({ pitch: 0, bearing: 10 });
  h.camera.orbit({ degrees: 60 });

  assert.equal(h.calls.length, 1, 'the rotation is staged behind the pitch change');
  assert.equal(h.calls[0]?.options.pitch, 46);

  h.runPending();
  const rotation = h.calls[1]?.options;
  assert.equal(rotation?.bearing, 70, 'rotation is relative to the current bearing');
  assert.equal(rotation?.easing?.(0.5), 0.5, 'an orbit rotates at a steady rate');
});

test('orbit skips the pitch stage when the plate is already tilted', () => {
  const h = harness({ pitch: 50 });
  h.camera.orbit();
  h.runPending();
  assert.equal(h.calls.length, 1, 'no redundant pitch change');
  assert.equal(h.calls[0]?.options.bearing, 60);
});

test('tilt toggles between the flat and cinematic plate', () => {
  const flat = harness({ pitch: 0 });
  flat.camera.tilt();
  assert.equal(flat.calls[0]?.options.pitch, 55);
  assert.equal(flat.announcements[0], 'Tilt · 55 degrees');

  const tilted = harness({ pitch: 55 });
  tilted.camera.tilt();
  assert.equal(tilted.calls[0]?.options.pitch, 0);
  assert.equal(tilted.announcements[0], 'Tilt · flat');
});

test('resetBearing eases bearing to zero, touching nothing else', () => {
  const h = harness({ bearing: 137, zoom: 8.2, pitch: 40 });
  h.camera.resetBearing();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0]?.method, 'easeTo');
  assert.equal(h.calls[0]?.options.bearing, 0);
  assert.equal(h.calls[0]?.options.zoom, undefined, 'zoom must be left alone');
  assert.equal(h.calls[0]?.options.pitch, undefined, 'pitch must be left alone');
  assert.equal(h.announcements[0], 'North · reset');
});

test('resetBearing is never refused — undoing a rotation is not camera drama', () => {
  const h = harness();
  h.camera.resetBearing();
  assert.equal(h.calls.length, 1, 'must not be silently gated like the dignity-checked moves');
});

test('resetBearing collapses to zero duration under reduced motion, like every other move', () => {
  const h = harness({ reducedMotion: true });
  h.camera.resetBearing();
  assert.equal(h.calls[0]?.options.duration, 0);
});

test('spotlight isolates without moving the camera', () => {
  const h = harness();
  h.camera.spotlight({ center: [-90.05, 32.3], radiusPercent: 20 });

  assert.equal(h.calls.length, 0, 'spotlight must not touch the camera');
  assert.deepEqual(h.spotlights[0], { center: [-90.05, 32.3], radiusPercent: 20 });
  assert.equal(h.camera.isSpotlit(), true);
});

test('spotlight toggles off on a second call', () => {
  const h = harness();
  h.camera.spotlight();
  h.camera.spotlight();
  assert.equal(h.camera.isSpotlit(), false);
  assert.deepEqual(h.announcements, ['Spotlight · on', 'Spotlight · off']);
});

test('trace establishes wide before drawing corridors', () => {
  const h = harness();
  h.camera.trace({ corridorCount: 7 });

  assert.equal(h.calls[0]?.method, 'fitBounds', 'trace starts from the establishing shot');
  assert.deepEqual(h.routes, [true]);
  assert.equal(h.announcements.at(-1), 'Trace · 7 corridors');
});

test('flyToRecord lands at record framing with padding applied once', () => {
  const h = harness();
  h.camera.flyToRecord({ center: [-86.81, 33.52], place: 'Birmingham, Alabama' });

  const flight = h.calls[0]?.options;
  assert.equal(h.calls[0]?.method, 'flyTo');
  assert.equal(flight?.zoom, 12.6);
  assert.equal(flight?.pitch, 52);
  assert.equal(flight?.bearing, -18);
  assert.equal(flight?.curve, CAMERA_FLY_CURVE);
  assert.deepEqual(flight?.padding, { top: 96, right: 40, bottom: 160, left: 40 });
  assert.equal(h.announcements[0], 'Fly to · Birmingham, Alabama');
});

test('a new move cancels the one in flight', () => {
  const h = harness();
  h.camera.push();
  const before = h.stopped();
  h.camera.tilt();
  assert.ok(h.stopped() > before, 'reader input always wins');
});

test('cancel stops the map and drops a staged orbit', () => {
  const h = harness({ pitch: 0 });
  h.camera.orbit();
  const staged = h.calls.length;

  h.camera.cancel();
  h.runPending();
  assert.equal(h.calls.length, staged, 'a canceled orbit must not rotate later');
  assert.ok(h.stopped() > 0);
});

test('the dignity gate turns a refused move into a silent no-op', () => {
  const calls: Call[] = [];
  const announcements: string[] = [];
  const warnings: unknown[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    const camera = createCamera({
      map: {
        flyTo: (options) => calls.push({ method: 'flyTo', options }),
        easeTo: (options) => calls.push({ method: 'easeTo', options }),
        fitBounds: (_b, options) => calls.push({ method: 'fitBounds', options }),
        getZoom: () => 5,
        getBearing: () => 0,
        getPitch: () => 0,
        getCenter: () => [-90, 35] as const,
      },
      padding: () => ({ top: 96, right: 40, bottom: 160, left: 40 }),
      reducedMotion: () => false,
      announce: (text) => announcements.push(text),
      activeRecord: () => ({ kind: 'event', topicTags: ['lynching'] }),
    });

    camera.push();
    camera.orbit();
    camera.trace();
    camera.spotlight();

    assert.deepEqual(calls, [], 'a refused move must not touch the camera');
    assert.deepEqual(announcements, [], 'a refused move must not reach the reader');
    assert.ok(warnings.length > 0, 'but it must be visible to a developer');

    // The dignified moves still work on the same record.
    camera.wide();
    camera.flyToRecord({ center: [-86.81, 33.52], place: 'Birmingham, Alabama' });
    assert.equal(calls.length, 2, 'arrival and framing stay available');
  } finally {
    console.warn = realWarn;
  }
});

test('moves are ungated when no record is active', () => {
  const h = harness();
  h.camera.push();
  h.camera.orbit();
  assert.ok(h.calls.length > 0, 'pure geography is not gated');
});

test('the library never reaches for maplibre-gl at runtime', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('./camera-moves.ts', import.meta.url), 'utf8');
  assert.ok(
    !/^import\s+(?!type)[^;]*from\s+'maplibre-gl'/m.test(source),
    'camera-moves must stay testable in plain Node',
  );
});
