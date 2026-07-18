/**
 * Decades-in-motion frame builder: cumulative reveal by earliest documented
 * decade, honest handling of undated records (final frame only), per-decade
 * edge slices, and presence-tier density over the cumulative set.
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

test('density levels cover exactly the states of the cumulative set', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('a', ['1870s'], DC), feature('b', ['1900s'], GA)]),
    {},
  );

  assert.deepEqual(
    frames[0]!.densityLevels.map((level) => level.statePostalCode),
    ['DC'],
  );
  assert.equal(frames[1]!.densityLevels.length, 2);
  for (const level of frames[1]!.densityLevels) {
    assert.ok(['documented', 'emerging', 'concentrated'].includes(level.tier));
  }
});
