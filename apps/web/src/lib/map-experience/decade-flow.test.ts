/**
 * Decades-in-motion frame builder: cumulative PIN reveal by earliest documented
 * decade, honest handling of undated records (final frame only), per-decade
 * edge slices, and presence-tier DENSITY over entities ACTIVE that decade
 * (delegated to `@blap/domain`'s `aggregateDecadePresence` — an entity whose
 * `eraBuckets` span has already ended does not inflate a later decade's
 * density, even though its pin remains on the map). The closing/complete
 * frame's density stays era-agnostic cumulative (everyone with a resolved
 * state, dated or not) — "the map today" is not itself a decade.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import type { HistoryEdgeLineCollection } from './build-history-edge-lines';
import { buildDecadeFlowFrames, FINAL_FRAME_LABEL } from './decade-flow';

function feature(
  id: string,
  eraBuckets: readonly string[],
  state?: { fips: string; postal: string; name: string },
): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-77, 38.9] },
    properties: {
      entityId: id,
      href: `/entity/${id}`,
      kind: 'place',
      displayName: id,
      oneLineStory: 'story',
      precision: 'city',
      geoPrecisionTier: 'locality',
      eraBuckets,
      notabilityLabels: [],
      evidenceCount: 1,
      confidenceTier: 'high',
      topicTags: [],
      ...(state
        ? { stateFips: state.fips, statePostalCode: state.postal, stateName: state.name }
        : {}),
    },
  } as ExploreMapFeature;
}

function collectionOf(features: readonly ExploreMapFeature[]): ExploreMapFeatureCollection {
  return { type: 'FeatureCollection', features };
}

const DC = { fips: '11', postal: 'DC', name: 'District of Columbia' };
const GA = { fips: '13', postal: 'GA', name: 'Georgia' };

const EDGE_LINE: HistoryEdgeLineCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-77, 38.9],
          [-84.4, 33.7],
        ],
      },
      properties: {
        edgeId: 'edge-1',
        relationshipType: 'succession',
        fromEntityId: 'a',
        toEntityId: 'b',
        fromDisplayName: 'A',
        toDisplayName: 'B',
        sentence: 'A succeeded B.',
        coincident: false,
      },
    },
  ],
};

test('frames are chronological and cumulative: later decades include earlier records', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([
      feature('a', ['1870s'], DC),
      feature('b', ['1900s'], GA),
      feature('c', ['1870s', '1900s'], DC),
    ]),
    {},
  );

  const labels = frames.map((frame) => frame.decade);
  assert.deepEqual(labels, ['1870s', '1900s', FINAL_FRAME_LABEL]);
  assert.equal(frames[0]!.cumulativeCount, 2); // a + c arrive with their earliest decade
  assert.equal(frames[1]!.cumulativeCount, 3);
});

test('undated records appear only in the closing full-archive frame', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('dated', ['1870s'], DC), feature('undated', [], GA)]),
    {},
  );

  const decadeFrame = frames[0]!;
  assert.equal(decadeFrame.cumulativeCount, 1);
  assert.ok(
    !decadeFrame.featureCollection.features.some((item) => item.properties.entityId === 'undated'),
  );

  const finalFrame = frames.at(-1)!;
  assert.equal(finalFrame.decade, FINAL_FRAME_LABEL);
  assert.equal(finalFrame.isComplete, true);
  assert.equal(finalFrame.cumulativeCount, 2);
});

test('per-decade edge slices attach to their decade; the final frame carries all-time lines', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('a', ['1870s'], DC), feature('b', ['1900s'], GA)]),
    { '1900s': EDGE_LINE },
    EDGE_LINE,
  );

  assert.equal(frames[0]!.edgeCollection.features.length, 0);
  assert.equal(frames[1]!.edgeCollection.features.length, 1);
  assert.equal(frames.at(-1)!.edgeCollection.features.length, 1);
});

test('an edge-only decade still produces a frame so movement is never skipped', () => {
  const frames = buildDecadeFlowFrames(collectionOf([feature('a', ['1870s'], DC)]), {
    '1910s': EDGE_LINE,
  });

  assert.deepEqual(
    frames.map((frame) => frame.decade),
    ['1870s', '1910s', FINAL_FRAME_LABEL],
  );
  assert.equal(frames[1]!.cumulativeCount, 1);
});

test('per-decade density levels cover exactly the states of entities ACTIVE that decade', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('a', ['1870s'], DC), feature('b', ['1900s'], GA)]),
    {},
  );

  assert.deepEqual(
    frames[0]!.densityLevels.map((level) => level.statePostalCode),
    ['DC'],
  );
  // 'a' (DC) is active only in the 1870s — it must NOT inflate the 1900s density,
  // even though its pin has already arrived by then (frames[1].cumulativeCount === 2).
  assert.deepEqual(
    frames[1]!.densityLevels.map((level) => level.statePostalCode),
    ['GA'],
  );
  assert.equal(frames[1]!.cumulativeCount, 2);
  for (const level of frames[1]!.densityLevels) {
    assert.ok(['documented', 'emerging', 'concentrated'].includes(level.tier));
  }
});

test('ACTIVE vs CUMULATIVE genuinely diverge: an entity that is no longer active drops out of a later decade\'s density, even though its pin never leaves once arrived', () => {
  // 'new-in-1900s' exists purely so a distinct 1900s frame gets built at all — the
  // frame axis only steps on a NEW arrival (a feature's OWN earliest decade), never
  // on every decade a longer-lived feature's span merely touches.
  const frames = buildDecadeFlowFrames(
    collectionOf([
      feature('short-lived', ['1870s'], DC),
      feature('spans-both', ['1870s', '1900s'], GA),
      feature('new-in-1900s', ['1900s'], GA),
    ]),
    {},
  );

  const d1870s = frames.find((frame) => frame.decade === '1870s')!;
  const d1900s = frames.find((frame) => frame.decade === '1900s')!;

  assert.deepEqual(d1870s.densityLevels.map((l) => l.statePostalCode).sort(), ['DC', 'GA']);
  // 'short-lived' (DC) is not active in the 1900s — density drops to GA only...
  assert.deepEqual(d1900s.densityLevels.map((l) => l.statePostalCode), ['GA']);
  // ...but its pin is still on the map (cumulative reveal never removes a pin).
  assert.equal(d1900s.cumulativeCount, 3);
  assert.ok(
    d1900s.featureCollection.features.some((f) => f.properties.entityId === 'short-lived'),
  );
});

test('the closing/complete frame density is era-agnostic cumulative — includes an undated-but-located record no decade could honestly claim', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('dated', ['1870s'], DC), feature('undated-located', [], GA)]),
    {},
  );

  const finalFrame = frames.at(-1)!;
  assert.equal(finalFrame.isComplete, true);
  assert.deepEqual(
    finalFrame.densityLevels.map((level) => level.statePostalCode).sort(),
    ['DC', 'GA'],
  );
});
