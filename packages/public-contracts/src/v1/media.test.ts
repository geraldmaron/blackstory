import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediaV1Schema } from './media.js';

const VALID_MEDIA = {
  url: 'https://storage.googleapis.com/black-book-media/entities/ent_1/primary.jpg',
  alt: 'Paul Laurence Dunbar High School building, 1917.',
  credit: 'Library of Congress',
  rightsStatus: 'public_domain' as const,
  width: 1600,
  height: 1200,
  objectPath: 'entities/ent_1/primary.jpg',
};

test('round-trips a valid media object', () => {
  assert.deepEqual(mediaV1Schema.parse(VALID_MEDIA), VALID_MEDIA);
});

test('rejects an unknown rightsStatus (adversarial: unknown enum value)', () => {
  assert.throws(() => mediaV1Schema.parse({ ...VALID_MEDIA, rightsStatus: 'all_rights_reserved' }));
});

test('rejects a non-http(s) url (adversarial: invalid URL / data: scheme)', () => {
  assert.throws(() => mediaV1Schema.parse({ ...VALID_MEDIA, url: 'data:image/png;base64,AAAA' }));
});

test('rejects a negative/zero width (adversarial: malformed numeric)', () => {
  assert.throws(() => mediaV1Schema.parse({ ...VALID_MEDIA, width: 0 }));
  assert.throws(() => mediaV1Schema.parse({ ...VALID_MEDIA, width: -100 }));
});
