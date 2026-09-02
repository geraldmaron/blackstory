import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityView } from '../../data/public-seed';
import {
  buildDoorPinPhotoIndex,
  buildEntityPhotoIndex,
  PIN_PHOTO_THUMBNAIL_WIDTH,
} from './entity-photo-index';
import { firstPaintPinId } from './first-paint-pins';

type EntityOverrides = Partial<PublicEntityView> & { readonly id: string };

/** Minimal projection: only the fields `buildEntityPhotoIndex` actually reads. */
function entity(overrides: EntityOverrides): PublicEntityView {
  return {
    kind: 'place',
    displayName: `Record ${overrides.id}`,
    summary: 'A documented record.',
    era: '1920s',
    topicTags: [],
    jurisdictionLabel: 'Oklahoma',
    locationPrecision: 'city',
    locationLabel: 'Tulsa',
    relevanceExplanation: '',
    historicalContext: '',
    recordMaturity: 'stub',
    researchCoverage: 'minimal',
    mapPin: { x: 0, y: 0 },
    claims: [],
    timeline: [],
    revision: {} as PublicEntityView['revision'],
    relatedIds: [],
    ...overrides,
  } as PublicEntityView;
}

const IMAGED_COMMONS = entity({
  id: 'ent_imaged_commons',
  primaryImage: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg',
    alt: 'A photograph',
    credit: 'Jane Doe · Wikimedia Commons',
    rightsStatus: 'public_domain',
    width: 2000,
    height: 1500,
    objectPath: 'entities/ent_imaged_commons/primary.jpg',
  },
});

const IMAGED_NON_COMMONS = entity({
  id: 'ent_imaged_gcs',
  primaryImage: {
    url: 'https://storage.googleapis.com/bucket/entities/ent_imaged_gcs/primary.jpg',
    alt: 'A different photograph',
    credit: 'BlackStory',
    rightsStatus: 'licensed',
  },
});

const UNIMAGED = entity({ id: 'ent_unimaged' });

test('the photo index contains only entities carrying a primaryImage', () => {
  const index = buildEntityPhotoIndex([IMAGED_COMMONS, IMAGED_NON_COMMONS, UNIMAGED]);
  assert.deepEqual(Object.keys(index).sort(), ['ent_imaged_commons', 'ent_imaged_gcs']);
});

test('each entry carries only url, alt, credit (and optional license/sourcePageUrl) — no rightsStatus, objectPath, width, or height', () => {
  const index = buildEntityPhotoIndex([IMAGED_COMMONS, IMAGED_NON_COMMONS]);
  const allowedKeys = new Set(['url', 'alt', 'credit', 'license', 'sourcePageUrl']);
  for (const photo of Object.values(index)) {
    for (const key of Object.keys(photo)) {
      assert.ok(allowedKeys.has(key), `unexpected key "${key}" in pin photo payload`);
    }
    assert.equal(typeof photo.url, 'string');
    assert.equal(typeof photo.alt, 'string');
    assert.equal(typeof photo.credit, 'string');
  }
});

test('a Commons-sourced photo is rewritten to the 480px thumbnail path', () => {
  const index = buildEntityPhotoIndex([IMAGED_COMMONS]);
  assert.equal(
    index.ent_imaged_commons?.url,
    `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/${PIN_PHOTO_THUMBNAIL_WIDTH}px-Example.jpg`,
  );
});

test('a non-Commons photo URL passes through unchanged', () => {
  const index = buildEntityPhotoIndex([IMAGED_NON_COMMONS]);
  assert.equal(
    index.ent_imaged_gcs?.url,
    'https://storage.googleapis.com/bucket/entities/ent_imaged_gcs/primary.jpg',
  );
});

test('the Door pin photo index is keyed by opaque pin id, never by a real entity id', () => {
  const features = [
    { properties: { entityId: 'ent_unimaged' } },
    { properties: { entityId: 'ent_imaged_commons' } },
  ];
  const index = buildDoorPinPhotoIndex(
    [IMAGED_COMMONS, IMAGED_NON_COMMONS, UNIMAGED],
    features,
    firstPaintPinId,
  );
  assert.deepEqual(Object.keys(index), [firstPaintPinId(1)]);
  assert.equal(index[firstPaintPinId(1)]?.credit, IMAGED_COMMONS.primaryImage?.credit);
  // No real entity id appears anywhere in the serialized payload.
  const serialized = JSON.stringify(index);
  assert.doesNotMatch(serialized, /ent_[a-z0-9_]+/);
});
