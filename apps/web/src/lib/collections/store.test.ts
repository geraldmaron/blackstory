/**
 * The saved list is the one thing on this surface the reader authored. These tests are mostly
 * about not losing it: corrupt payloads, storage that throws, and a payload from a newer build.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLLECTIONS_SCHEMA_VERSION,
  COLLECTIONS_STORAGE_KEY,
  EMPTY_COLLECTION,
  isSaved,
  readCollection,
  saveRecord,
  savedIds,
  toGeoJson,
  unmappableCount,
  unsaveRecord,
  writeCollection,
  type SavedRecord,
  type StorageLike,
} from './store';

function memoryStorage(initial?: string): StorageLike & { readonly dump: () => string | null } {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    removeItem: () => {
      value = null;
    },
    dump: () => value,
  };
}

const MOTEL: SavedRecord = {
  id: 'ent_gaston_motel',
  name: 'A.G. Gaston Motel',
  kind: 'place',
  place: 'Birmingham, Alabama',
  era: '1950s',
  grade: 'A',
  href: '/entity/ent_gaston_motel',
  lng: -86.81,
  lat: 33.52,
  savedAt: '2026-07-30T00:00:00.000Z',
};

const UNMAPPED: SavedRecord = {
  id: 'ent_withheld',
  name: 'A record with no published point',
  kind: 'person',
  place: 'Place withheld',
  era: '1920s',
  grade: null,
  href: '/entity/ent_withheld',
  savedAt: '2026-07-30T00:00:00.000Z',
};

test('an empty store reads as an empty collection', () => {
  assert.deepEqual(readCollection(memoryStorage()), EMPTY_COLLECTION);
  assert.deepEqual(readCollection(null), EMPTY_COLLECTION);
  assert.deepEqual(readCollection(undefined), EMPTY_COLLECTION);
});

test('a collection round-trips through storage', () => {
  const storage = memoryStorage();
  writeCollection(storage, saveRecord(EMPTY_COLLECTION, MOTEL));
  const read = readCollection(storage);
  assert.equal(read.records.length, 1);
  assert.deepEqual(read.records[0], MOTEL);
  assert.equal(read.version, COLLECTIONS_SCHEMA_VERSION);
});

test('the stored payload carries its schema version', () => {
  const storage = memoryStorage();
  writeCollection(storage, saveRecord(EMPTY_COLLECTION, MOTEL));
  const payload = JSON.parse(storage.dump() ?? '{}');
  assert.equal(payload.version, COLLECTIONS_SCHEMA_VERSION);
});

test('corrupt JSON reads as empty rather than throwing on mount', () => {
  assert.deepEqual(readCollection(memoryStorage('{"records": [')), EMPTY_COLLECTION);
  assert.deepEqual(readCollection(memoryStorage('not json at all')), EMPTY_COLLECTION);
  assert.deepEqual(readCollection(memoryStorage('null')), EMPTY_COLLECTION);
  assert.deepEqual(readCollection(memoryStorage('[]')), EMPTY_COLLECTION);
});

test('a payload shaped wrong inside reads as empty', () => {
  assert.deepEqual(
    readCollection(memoryStorage('{"version":1,"records":"nope"}')),
    EMPTY_COLLECTION,
  );
  assert.deepEqual(readCollection(memoryStorage('{"records":[]}')), EMPTY_COLLECTION);
});

test('a payload from a newer build is left alone rather than half-read', () => {
  const future = JSON.stringify({ version: 99, records: [MOTEL] });
  assert.deepEqual(readCollection(memoryStorage(future)), EMPTY_COLLECTION);
});

test('entries missing required fields are dropped, the rest survive', () => {
  const mixed = JSON.stringify({
    version: 1,
    records: [MOTEL, { name: 'no id' }, null, 'a string', { id: 'x', name: 'y', href: '/z' }],
  });
  const read = readCollection(memoryStorage(mixed));
  assert.deepEqual(
    read.records.map((record) => record.id),
    ['ent_gaston_motel', 'x'],
  );
});

test('an entry missing an optional field is normalised, not discarded', () => {
  const partial = JSON.stringify({
    version: 1,
    records: [{ id: 'x', name: 'Partial', href: '/entity/x' }],
  });
  const record = readCollection(memoryStorage(partial)).records[0];
  assert.equal(record?.kind, 'other');
  assert.equal(record?.grade, null);
  assert.equal(record?.place, '');
});

test('storage that throws does not take the surface down', () => {
  const hostile: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
  };
  assert.deepEqual(readCollection(hostile), EMPTY_COLLECTION);
  assert.doesNotThrow(() => writeCollection(hostile, saveRecord(EMPTY_COLLECTION, MOTEL)));
});

test('saving the same record twice does not duplicate it', () => {
  const once = saveRecord(EMPTY_COLLECTION, MOTEL);
  const twice = saveRecord(once, MOTEL);
  assert.equal(twice.records.length, 1);
});

test('re-saving moves a record to the front', () => {
  const collection = saveRecord(saveRecord(EMPTY_COLLECTION, MOTEL), UNMAPPED);
  const resaved = saveRecord(collection, MOTEL);
  assert.deepEqual(
    resaved.records.map((record) => record.id),
    ['ent_gaston_motel', 'ent_withheld'],
  );
});

test('unsave removes only the named record', () => {
  const collection = saveRecord(saveRecord(EMPTY_COLLECTION, MOTEL), UNMAPPED);
  const after = unsaveRecord(collection, MOTEL.id);
  assert.equal(isSaved(after, MOTEL.id), false);
  assert.equal(isSaved(after, UNMAPPED.id), true);
});

test('unsaving something that was never saved is a no-op', () => {
  const collection = saveRecord(EMPTY_COLLECTION, MOTEL);
  assert.deepEqual(unsaveRecord(collection, 'nothing').records, collection.records);
});

test('savedIds gives the rail its lookup set', () => {
  const ids = savedIds(saveRecord(EMPTY_COLLECTION, MOTEL));
  assert.equal(ids.has('ent_gaston_motel'), true);
  assert.equal(ids.has('other'), false);
});

test('GeoJSON export omits records with no published point rather than placing them at 0,0', () => {
  const collection = saveRecord(saveRecord(EMPTY_COLLECTION, MOTEL), UNMAPPED);
  const geojson = toGeoJson(collection);
  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 1);
  assert.equal(unmappableCount(collection), 1);

  const serialized = JSON.stringify(geojson);
  assert.equal(serialized.includes('[0,0]'), false);
  assert.match(serialized, /-86\.81/);
});

test('the storage key is namespaced and versioned', () => {
  assert.match(COLLECTIONS_STORAGE_KEY, /^blackstory\./);
  assert.match(COLLECTIONS_STORAGE_KEY, /v1$/);
});
