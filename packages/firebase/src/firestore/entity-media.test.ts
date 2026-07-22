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

test('entityPrimaryImageObjectRef includes GCS upload bucket and Supabase HTTPS URL', () => {
  const ref = entityPrimaryImageObjectRef('ent_seed_school_001');
  assert.equal(ref.bucket, DEFAULT_PUBLIC_MEDIA_BUCKET);
  assert.equal(ref.objectPath, 'public/entities/ent_seed_school_001/primary.png');
  assert.equal(
    ref.publicUrl,
    'https://twykhihqkcldpreuovay.supabase.co/storage/v1/object/public/public-media/public/entities/ent_seed_school_001/primary.png',
  );
});
