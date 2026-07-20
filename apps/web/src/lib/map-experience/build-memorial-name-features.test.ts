/**
 * Unit tests for full-plate memorial name GeoJSON placement (eligible archive).
 * Organic non-lattice anchors stay off US state land; labels are name-only with
 * size/rotation variance; single-token names are excluded.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMemorialNameFeatures,
  isMemorialAnchorOnStateLand,
  memorialDecadeStart,
  MEMORIAL_LABEL_TEXT_FONT,
  MEMORIAL_LABEL_SIZE_MAX,
  MEMORIAL_LABEL_SIZE_MIN,
} from './build-memorial-name-features';
import {
  MEMORIAL_NAMES_PLATE,
  MEMORIAL_NAMES_REQUIRED,
  isMemorialNamePlateEligible,
} from '../../components/atmosphere/memorial-names';

test('buildMemorialNameFeatures defaults to the eligible full-name pool', () => {
  const collection = buildMemorialNameFeatures({ seedKey: 'map-stage' });
  assert.equal(collection.type, 'FeatureCollection');
  assert.equal(collection.features.length, MEMORIAL_NAMES_PLATE.length);
  assert.ok(collection.features.length >= 1000);
  for (const feature of collection.features) {
    assert.ok(
      isMemorialNamePlateEligible({
        name: feature.properties.name,
        year: feature.properties.year,
        category: 'police_violence',
      }),
      `single-token name leaked onto plate: ${feature.properties.name}`,
    );
  }
});

test('placements stay seed-stable', () => {
  const a = buildMemorialNameFeatures({ seedKey: 'map-stage', count: 36 });
  const b = buildMemorialNameFeatures({ seedKey: 'map-stage', count: 36 });
  assert.deepEqual(a, b);
});

test('required memorial names are included in the full set', () => {
  const names = new Set(
    buildMemorialNameFeatures({ seedKey: 'map-stage' }).features.map((f) => f.properties.name),
  );
  for (const required of MEMORIAL_NAMES_REQUIRED) {
    assert.ok(names.has(required), `missing required name ${required}`);
  }
});

test('anchors stay outside US state land bboxes and span the plate', () => {
  const collection = buildMemorialNameFeatures({ seedKey: 'map-stage', count: 200 });
  assert.ok(
    collection.features.length >= 150,
    `expected enough non-state anchors, got ${collection.features.length}`,
  );
  const lngs = collection.features.map((f) => f.geometry.coordinates[0]!);
  const lats = collection.features.map((f) => f.geometry.coordinates[1]!);
  assert.ok(Math.max(...lngs) - Math.min(...lngs) > 40, 'lng span too narrow');
  assert.ok(Math.max(...lats) - Math.min(...lats) > 15, 'lat span too narrow');
  for (const feature of collection.features) {
    const [lng, lat] = feature.geometry.coordinates;
    assert.equal(
      isMemorialAnchorOnStateLand(lng, lat),
      false,
      `anchor on state land: ${feature.properties.name} @ ${lng},${lat}`,
    );
  }
});

test('memorial labels use Italic face with size and rotation variance', () => {
  const collection = buildMemorialNameFeatures({ seedKey: 'map-stage', count: 80 });
  const sizes = new Set(collection.features.map((f) => f.properties.size));
  const rotates = new Set(collection.features.map((f) => f.properties.rotate));
  assert.ok(sizes.size >= 3, `expected size variance, got ${[...sizes]}`);
  assert.ok(rotates.size >= 5, `expected rotation variance, got ${rotates.size} unique`);
  for (const size of sizes) {
    assert.ok(size >= MEMORIAL_LABEL_SIZE_MIN && size <= MEMORIAL_LABEL_SIZE_MAX);
  }
  assert.deepEqual([...MEMORIAL_LABEL_TEXT_FONT], ['Noto Sans Italic']);
});

test('features carry name + decade fields only — no year/place meta line', () => {
  const feature = buildMemorialNameFeatures({ seedKey: 'map', count: 20 }).features[0];
  assert.ok(feature);
  assert.ok(feature.properties.name.length > 0);
  assert.equal('meta' in feature.properties, false);
  assert.ok(feature.properties.year >= 1800);
  assert.equal(feature.properties.decadeStart, memorialDecadeStart(feature.properties.year));
  assert.equal(feature.id, feature.properties.id);
  assert.ok(feature.properties.ink > 0 && feature.properties.ink <= 1);
  assert.ok(typeof feature.properties.rotate === 'number');
});
