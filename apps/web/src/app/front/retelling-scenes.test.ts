import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TourCamera } from './camera-path';
import {
  MAX_PIN_SCREENS,
  MAX_TOTAL_SCREENS,
  RECORD_SCENE_IDS,
  RETELLING_SCENES,
  isRecordScene,
  retellingCameraAt,
  retellingPhase,
  retellingScreens,
  type RetellingLayout,
} from './retelling-scenes';

const SCREEN = 800;
/** The pinned layout: each scene as tall as its `screens`, stacked. */
function pinnedLayout(): RetellingLayout {
  let top = 0;
  return {
    screen: SCREEN,
    scenes: RETELLING_SCENES.map((scene) => {
      const box = { top, height: scene.screens * SCREEN };
      top += box.height;
      return box;
    }),
  };
}

describe('the retelling scenes', () => {
  it('is the six words, in the brand order', () => {
    assert.deepEqual(
      RETELLING_SCENES.map((scene) => scene.heading),
      ['History', 'His story', 'Her story', 'Your story', 'Their story', 'BlackStory'],
    );
  });

  it('changes only the prefix: every scene after the first ends in "story"', () => {
    for (const scene of RETELLING_SCENES.slice(1)) {
      assert.ok(scene.prefix.length > 0, scene.id);
      assert.match(scene.heading, /story$/i, scene.id);
    }
    assert.equal(RETELLING_SCENES[0]!.prefix, '');
  });

  it('shows no record in scene 1, one in scenes 2, 3 and 5, the town in 4', () => {
    assert.deepEqual(
      RETELLING_SCENES.map((scene) => scene.kind),
      ['word', 'record', 'record', 'town', 'record', 'country'],
    );
    assert.deepEqual(RECORD_SCENE_IDS, ['his-story', 'her-story', 'their-story']);
    assert.equal(isRecordScene('your-story'), false);
  });

  it('holds no scene longer than a screen and a half, and stays under eight screens', () => {
    for (const scene of RETELLING_SCENES) {
      assert.ok(scene.screens >= 1, scene.id);
      assert.ok(scene.screens - 1 <= MAX_PIN_SCREENS, scene.id);
    }
    assert.ok(retellingScreens(pinnedLayout()) <= MAX_TOTAL_SCREENS);
  });
});

describe('where the scroll is', () => {
  const layout = pinnedLayout();
  const second = layout.scenes[1]!;

  it('holds on the first scene at the top', () => {
    assert.deepEqual(retellingPhase(0, layout), { from: 0, to: 0, t: 0, current: 0 });
  });

  it('crosses to the next scene over exactly one screen', () => {
    const start = second.top - SCREEN;
    assert.equal(retellingPhase(start, layout).from, 0);
    assert.equal(retellingPhase(start, layout).to, 0);
    const mid = retellingPhase(start + SCREEN / 4, layout);
    assert.deepEqual([mid.from, mid.to, mid.t, mid.current], [0, 1, 0.25, 0]);
    const late = retellingPhase(start + (SCREEN * 3) / 4, layout);
    assert.deepEqual([late.from, late.to, late.current], [0, 1, 1]);
  });

  it('holds on a scene once it has landed, then leaves it', () => {
    const landed = retellingPhase(second.top, layout);
    assert.deepEqual([landed.from, landed.to, landed.current], [1, 1, 1]);
    const leaving = retellingPhase(layout.scenes[2]!.top - SCREEN / 2, layout);
    assert.deepEqual([leaving.from, leaving.to, leaving.t], [1, 2, 0.5]);
  });

  it('plays backward: the same position always gives the same phase', () => {
    const y = second.top - 123;
    assert.deepEqual(retellingPhase(y, layout), retellingPhase(y, layout));
  });

  it('stays on the last scene past the end', () => {
    const last = RETELLING_SCENES.length - 1;
    const phase = retellingPhase(1e9, layout);
    assert.deepEqual([phase.from, phase.to, phase.current], [last, last, last]);
  });

  it('answers an empty or unmeasured page without throwing', () => {
    assert.deepEqual(retellingPhase(50, { scenes: [], screen: 800 }), {
      from: 0,
      to: 0,
      t: 0,
      current: 0,
    });
    assert.equal(retellingScreens({ scenes: [], screen: 0 }), 0);
  });
});

describe('the camera for a phase', () => {
  const padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const country: TourCamera = { center: [-95.5, 38.3], zoom: 3.9, pitch: 0, padding };
  const south: TourCamera = { center: [-84.28, 30.44], zoom: 13, pitch: 45, padding };
  const north: TourCamera = { center: [-76.56, 42.93], zoom: 13, pitch: 45, padding };
  const anchors = [country, south, north, country];
  const cameras = { orbit: country, span: 800 };

  it('is the scene camera itself on a hold', () => {
    assert.equal(retellingCameraAt({ from: 1, to: 1, t: 0, current: 1 }, anchors, cameras), south);
  });

  it('dives from the country onto a record and rises from one back to it', () => {
    const down = retellingCameraAt({ from: 0, to: 1, t: 1, current: 1 }, anchors, cameras)!;
    assert.deepEqual([down.zoom, down.pitch], [13, 45]);
    const up = retellingCameraAt({ from: 2, to: 3, t: 1, current: 3 }, anchors, cameras)!;
    assert.ok(Math.abs(up.zoom - country.zoom) < 1e-9);
  });

  it('rises between two records only as far as it takes, never past the country', () => {
    const peak = retellingCameraAt({ from: 1, to: 2, t: 0.5, current: 2 }, anchors, cameras)!;
    assert.ok(peak.zoom < 13);
    assert.ok(peak.zoom >= country.zoom);
    assert.equal(peak.pitch, 0);
  });

  it('does not move between two scenes that share the country', () => {
    const still = retellingCameraAt({ from: 0, to: 3, t: 0.4, current: 0 }, anchors, cameras);
    assert.equal(still, country);
  });
});
