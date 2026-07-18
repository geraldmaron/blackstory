/**
 * Tests for public-media entity primary-image object path helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_PUBLIC_MEDIA_BUCKET,
  entityPrimaryImageObjectPath,
  entityPrimaryImageObjectRef,
} from './entity-media.js';

test('entityPrimaryImageObjectPath builds the canonical GCS object key', () => {
  assert.equal(
    entityPrimaryImageObjectPath('ent_seed_school_001'),
    'public/entities/ent_seed_school_001/primary.png',
  );
  assert.equal(
    entityPrimaryImageObjectPath('ent_seed_school_001', 'hero.webp'),
    'public/entities/ent_seed_school_001/hero.webp',
  );
});

test('entityPrimaryImageObjectRef includes bucket and HTTPS URL', () => {
  const ref = entityPrimaryImageObjectRef('ent_seed_school_001');
  assert.equal(ref.bucket, DEFAULT_PUBLIC_MEDIA_BUCKET);
  assert.equal(ref.objectPath, 'public/entities/ent_seed_school_001/primary.png');
  assert.equal(
    ref.publicUrl,
    `https://storage.googleapis.com/${DEFAULT_PUBLIC_MEDIA_BUCKET}/public/entities/ent_seed_school_001/primary.png`,
  );
});
