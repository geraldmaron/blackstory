/**
 * metadata builder tests protected fields must never reach previews.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEntityPageMetadata,
  buildPublicMetadataPreview,
  buildStaticPageMetadata,
} from './metadata-builders';
import { PROTECTED_METADATA_KEYS, stripProtectedFields } from './protected-fields';

test('stripProtectedFields removes confidence scores and coordinates', () => {
  const stripped = stripProtectedFields({
    displayName: 'Safe title',
    confidenceScore: 0.92,
    mapPin: { x: 12, y: 34 },
    summary: 'Public-safe summary',
  });
  assert.equal(stripped.displayName, 'Safe title');
  assert.equal(stripped.confidenceScore, undefined);
  assert.equal(stripped.mapPin, undefined);
});

test('buildEntityPageMetadata omits residential addresses and dispute notes from description', () => {
  const metadata = buildEntityPageMetadata({
    id: 'ent_test',
    displayName: 'Sample school',
    summary: '123 Main Street, Springfield — internal only',
    disputeNote: 'moderation note',
    confidenceScore: 0.88,
    sensitivity: { class: 'contextual', basisClaimIds: ['clm_hidden'] },
  });
  assert.equal(typeof metadata.description, 'string');
  assert.doesNotMatch(metadata.description as string, /123 Main Street/i);
  assert.doesNotMatch(metadata.description as string, /moderation/i);
  assert.doesNotMatch(metadata.description as string, /0\.88/);
});

test('buildPublicMetadataPreview sets canonical and openGraph without protected keys', () => {
  const preview = buildPublicMetadataPreview({
    title: 'Search',
    description: 'Keyword search over published records.',
    canonicalPath: '/search',
  });
  assert.equal(preview.title, 'Search');
  assert.equal(preview.openGraph?.url?.endsWith('/search'), true);
  for (const key of PROTECTED_METADATA_KEYS) {
    const serialized = JSON.stringify(preview);
    assert.doesNotMatch(serialized, new RegExp(`"${key}"`));
  }
});

test('buildStaticPageMetadata honors noIndex for non-public surfaces', () => {
  const metadata = buildStaticPageMetadata({
    path: '/admin',
    title: 'Admin',
    description: 'Restricted',
    noIndex: true,
  });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});
