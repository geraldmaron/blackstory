import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { listPublicEntities } from '../../data/public-seed';
import { getHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import { buildAtlasCatalogPayload } from '../../app/explore/atlas-catalog';
import { parseExploreSearchParams } from '../map-experience/url-state';
import { matchExploreCollection } from './explore-collection';
import { encodeCollectionCatalog, decodeCollectionCatalog } from './collection-catalog-wire';

const entities = listPublicEntities();
const seed = buildAtlasCatalogPayload(
  entities,
  getHistoryGraphReleaseArtifact(entities),
  {},
  'none',
);

const jsonRoundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function fixture(stories: readonly string[]) {
  const feature = seed.source.featureCollection.features[0]!;
  const fact = seed.collectionFacts![0]!;
  return jsonRoundTrip({
    ...seed,
    source: {
      ...seed.source,
      featureCollection: {
        ...seed.source.featureCollection,
        features: stories.map((story, index) => ({
          ...feature,
          properties: { ...feature.properties, entityId: `fixture-${index}`, oneLineStory: story },
        })),
      },
    },
    collectionFacts: stories.map((story, index) => ({
      ...fact,
      row: { ...fact.row, id: `fixture-${index}` },
      haystack: `prefix ${story.toLowerCase()} suffix`,
    })),
  });
}

const longStory = 'Documented school history and an exact quotation. '.repeat(12);

test('transport round-trips the entire catalog and preserves string match behavior', () => {
  const original = fixture([longStory, 'École İSTANBUL Straße '.repeat(20)]);
  const before = JSON.stringify(original);
  const wire = encodeCollectionCatalog(original);
  assert.ok(wire.collectionFacts.every((fact) => Array.isArray(fact.haystack)));
  const decoded = decodeCollectionCatalog(JSON.parse(JSON.stringify(wire)));
  assert.deepEqual(decoded, original);
  assert.equal(JSON.stringify(original), before, 'encoder never mutates in-memory facts');
  for (const q of ['quotation', 'prefix', 'suffix', 'école', 'i\u0307stanbul', 'absent']) {
    const state = parseExploreSearchParams({ q, sort: 'name' });
    assert.deepEqual(
      matchExploreCollection(decoded.collectionFacts!, state),
      matchExploreCollection(original.collectionFacts, state),
    );
  }
});

test('already-raw compatible catalogs remain accepted', () => {
  assert.deepEqual(
    decodeCollectionCatalog(JSON.parse(JSON.stringify(seed))),
    JSON.parse(JSON.stringify(seed)),
  );
});

test('unlocated records, nonmatching text and short text keep their exact raw haystacks', () => {
  const original = fixture([longStory, '', 'short']);
  original.collectionFacts[0] = {
    ...original.collectionFacts[0]!,
    row: { ...original.collectionFacts[0]!.row, id: 'unlocated' },
  };
  original.collectionFacts[1] = {
    ...original.collectionFacts[1]!,
    haystack: 'unrelated complete text',
  };
  original.collectionFacts[2] = { ...original.collectionFacts[2]!, haystack: 'short' };
  const encoded = encodeCollectionCatalog(original);
  assert.ok(encoded.collectionFacts.every((fact) => typeof fact.haystack === 'string'));
  assert.deepEqual(decodeCollectionCatalog(JSON.parse(JSON.stringify(encoded))), original);
});

test('malformed references fail before any catalog facts can be accepted', () => {
  const original = fixture([longStory]);
  const wire = encodeCollectionCatalog(original);
  const corruptions: unknown[] = [
    [-1, '', ''],
    [100, '', ''],
    [0.5, '', ''],
    ['0', '', ''],
    [null, '', ''],
    [0, null, ''],
    [0, '', {}],
    [0, ''],
    [0, '', '', 'extra'],
    {},
    null,
  ];
  for (const haystack of corruptions) {
    const malformed = { ...wire, collectionFacts: [{ ...wire.collectionFacts[0], haystack }] };
    assert.throws(() => decodeCollectionCatalog(malformed), /unexpected collection transport/);
  }
  assert.throws(
    () => decodeCollectionCatalog({ ...wire, collectionTextEncoding: 'unknown' }),
    /unexpected collection transport/,
  );
  const { collectionTextEncoding: _encoding, ...untagged } = wire;
  assert.throws(() => decodeCollectionCatalog(untagged), /unexpected collection transport/);
  for (const properties of [
    { ...original.source.featureCollection.features[0]!.properties, entityId: 'wrong-record' },
    { ...original.source.featureCollection.features[0]!.properties, oneLineStory: '' },
    { ...original.source.featureCollection.features[0]!.properties, oneLineStory: null },
  ]) {
    const source = {
      ...wire.source,
      featureCollection: {
        ...wire.source.featureCollection,
        features: [{ ...wire.source.featureCollection.features[0], properties }],
      },
    };
    assert.throws(
      () => decodeCollectionCatalog({ ...wire, source }),
      /unexpected collection transport/,
    );
  }
  assert.throws(
    () => decodeCollectionCatalog({ ...wire, collectionFacts: undefined }),
    /unexpected collection transport/,
  );
});

test('references materially reduce gzip for a varied catalog with long duplicated text', () => {
  let state = 413;
  const stories = Array.from({ length: 180 }, (_, index) => {
    const words = Array.from({ length: 160 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state.toString(36);
    });
    return `Record ${index} documents ${words.join(' ')}.`;
  });
  const original = fixture(stories);
  const wire = encodeCollectionCatalog(original);
  const compressedOriginal = gzipSync(JSON.stringify(original)).length;
  const compressedWire = gzipSync(JSON.stringify(wire)).length;
  assert.ok(
    compressedWire < compressedOriginal * 0.8,
    `${compressedWire} should be at least 20% below ${compressedOriginal}`,
  );
  assert.deepEqual(decodeCollectionCatalog(JSON.parse(JSON.stringify(wire))), original);
});
