/**
 * Decades-in-motion frame builder: cumulative PIN reveal by earliest documented
 * decade (newest → oldest play/display order), honest handling of undated
 * records (final frame only), per-decade edge slices, and density fills.
 *
 * Without a population index, density is ACTIVE archive presence. With an index,
 * density is absolute Census Black population (missing rows omitted); pins still
 * accumulate from the archive independently.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StatePopulationIndex } from '@repo/domain/map/state-population';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import type { HistoryEdgeLineCollection } from './build-history-edge-lines';
import { buildDecadeFlowFrames, FINAL_FRAME_LABEL } from './decade-flow';
import { kindFamilyFor } from './kind-encoding';

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
      shade: '#C48A4A',
      glyph: 'circle',
      kindFamily: kindFamilyFor('place'),
      ...(state
        ? { stateFips: state.fips, statePostalCode: state.postal, stateName: state.name }
        : {}),
    },
  };
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

const POP_INDEX: StatePopulationIndex = {
  vintages: ['1790', '1870', '2000', '2020'],
  states: {
    '11': {
      '1870': { totalPopulation: 131_700, blackPopulation: 43_404 },
      '2000': { totalPopulation: 572_059, blackPopulation: 343_312 },
      '2020': { totalPopulation: 689_545, blackPopulation: 285_810 },
    },
    '13': {
      '1790': { totalPopulation: 82_548, blackPopulation: 29_662 },
      '1870': { totalPopulation: 1_184_109, blackPopulation: 545_142 },
      '2000': { totalPopulation: 8_186_453, blackPopulation: 2_349_542 },
      '2020': { totalPopulation: 10_711_908, blackPopulation: 3_320_513 },
    },
  },
};

test('frames are newest-to-oldest and cumulative: later (older) decades show fewer arrivals', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([
      feature('a', ['1870s'], DC),
      feature('b', ['1900s'], GA),
      feature('c', ['1870s', '1900s'], DC),
    ]),
    {},
  );

  const labels = frames.map((frame) => frame.decade);
  assert.deepEqual(labels, ['1900s', '1870s', FINAL_FRAME_LABEL]);
  assert.equal(frames[0]!.cumulativeCount, 3);
  assert.equal(frames[1]!.cumulativeCount, 2);
  assert.equal(frames[0]!.densityMode, 'presence');
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

  assert.equal(frames[0]!.edgeCollection.features.length, 1);
  assert.equal(frames[1]!.edgeCollection.features.length, 0);
  assert.equal(frames.at(-1)!.edgeCollection.features.length, 1);
});

test('an edge-only decade still produces a frame so movement is never skipped', () => {
  const frames = buildDecadeFlowFrames(collectionOf([feature('a', ['1870s'], DC)]), {
    '1910s': EDGE_LINE,
  });

  assert.deepEqual(
    frames.map((frame) => frame.decade),
    ['1910s', '1870s', FINAL_FRAME_LABEL],
  );
  assert.equal(frames[0]!.cumulativeCount, 1);
});

test('per-decade density levels cover exactly the states of entities ACTIVE that decade', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('a', ['1870s'], DC), feature('b', ['1900s'], GA)]),
    {},
  );

  assert.deepEqual(
    frames[0]!.densityLevels.map((level) => level.statePostalCode),
    ['GA'],
  );
  assert.deepEqual(
    frames[1]!.densityLevels.map((level) => level.statePostalCode),
    ['DC'],
  );
  assert.equal(frames[0]!.cumulativeCount, 2);
  for (const level of frames[0]!.densityLevels) {
    assert.ok(['documented', 'emerging', 'concentrated'].includes(level.tier));
  }
});

test("ACTIVE vs CUMULATIVE genuinely diverge: an entity that is no longer active drops out of a later decade's density, even though its pin never leaves once arrived", () => {
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
  assert.deepEqual(
    d1900s.densityLevels.map((l) => l.statePostalCode),
    ['GA'],
  );
  assert.equal(d1900s.cumulativeCount, 3);
  assert.ok(d1900s.featureCollection.features.some((f) => f.properties.entityId === 'short-lived'));
});

test('the closing/complete frame density is era-agnostic cumulative — includes an undated-but-located record no decade could honestly claim', () => {
  const frames = buildDecadeFlowFrames(
    collectionOf([feature('dated', ['1870s'], DC), feature('undated-located', [], GA)]),
    {},
  );

  const finalFrame = frames.at(-1)!;
  assert.equal(finalFrame.isComplete, true);
  assert.deepEqual(finalFrame.densityLevels.map((level) => level.statePostalCode).sort(), [
    'DC',
    'GA',
  ]);
});

test('population index drives fills from absolute Black counts and unions census vintages onto the frame axis', () => {
  const frames = buildDecadeFlowFrames(collectionOf([feature('a', ['1870s'], DC)]), {}, undefined, {
    statePopulationIndex: POP_INDEX,
    nationalBlackByDecade: { '1870': 4_880_009, '2020': 41_104_200 },
  });

  const labels = frames.map((frame) => frame.decade);
  assert.ok(labels.includes('1790s'));
  assert.ok(labels.includes('2000s'));
  assert.ok(labels.includes('2020s'));
  assert.equal(labels.at(-1), FINAL_FRAME_LABEL);

  const d1790 = frames.find((frame) => frame.decade === '1790s')!;
  assert.equal(d1790.densityMode, 'population');
  assert.deepEqual(
    d1790.densityLevels.map((level) => level.statePostalCode),
    ['GA'],
  );
  assert.equal(d1790.densityLevels[0]!.count, 29_662);
  assert.equal(d1790.cumulativeCount, 0);

  const d1870 = frames.find((frame) => frame.decade === '1870s')!;
  assert.equal(d1870.blackPopulationTotal, 4_880_009);
  assert.equal(d1870.cumulativeCount, 1);
  assert.ok(
    d1870.densityLevels.some(
      (level) => level.statePostalCode === 'GA' && level.tier === 'concentrated',
    ),
  );

  const d2000 = frames.find((frame) => frame.decade === '2000s')!;
  assert.equal(d2000.opensDefinitionBoundary, true);

  const today = frames.at(-1)!;
  assert.equal(today.densityMode, 'population');
  assert.equal(today.blackPopulationTotal, 41_104_200);
  assert.ok(today.densityLevels.some((level) => level.statePostalCode === 'GA'));
  assert.equal(today.cumulativeCount, 1);
});
