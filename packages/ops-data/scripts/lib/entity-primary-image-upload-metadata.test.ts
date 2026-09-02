import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENTITY_PRIMARY_IMAGE_CACHE_CONTROL,
  entityPrimaryImageUploadMetadata,
} from './entity-primary-image-upload-metadata.ts';

test('ENTITY_PRIMARY_IMAGE_CACHE_CONTROL is a public, one-hour browser cache directive', () => {
  assert.equal(ENTITY_PRIMARY_IMAGE_CACHE_CONTROL, 'public, max-age=3600');
});

test('entityPrimaryImageUploadMetadata carries content type, cache-control, and custom metadata', () => {
  const metadata = entityPrimaryImageUploadMetadata({
    contentType: 'image/jpeg',
    custom: { entityId: 'ent_1', purpose: 'entity-primary-image' },
  });
  assert.deepEqual(metadata, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=3600',
    metadata: { entityId: 'ent_1', purpose: 'entity-primary-image' },
  });
});
