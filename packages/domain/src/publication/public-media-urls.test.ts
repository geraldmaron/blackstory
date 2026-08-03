/**
 * Unit tests for Supabase / GCS public-media URL helpers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gcsPublicMediaUrl,
  resolvePublicMediaUrl,
  supabasePublicMediaUrl,
} from './public-media-urls.js';

test('supabasePublicMediaUrl builds storage public object URL', () => {
  assert.equal(
    supabasePublicMediaUrl('public/entities/ent_x/primary.jpg'),
    'https://twykhihqkcldpreuovay.supabase.co/storage/v1/object/public/public-media/public/entities/ent_x/primary.jpg',
  );
});

test('gcsPublicMediaUrl builds legacy GCS HTTPS URL', () => {
  assert.equal(
    gcsPublicMediaUrl('public/entities/ent_x/primary.jpg'),
    'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_x/primary.jpg',
  );
});

test('resolvePublicMediaUrl defaults to Supabase and can prefer GCS', () => {
  // Host-anchored: the assertion is about which service serves the object, and a substring
  // match would also accept `https://evil.example/?x=supabase.co`.
  assert.ok(
    new URL(resolvePublicMediaUrl('public/entities/ent_x/primary.jpg')).hostname.endsWith(
      'supabase.co',
    ),
  );
  assert.equal(
    new URL(resolvePublicMediaUrl('public/entities/ent_x/primary.jpg', { preferSupabase: false }))
      .hostname,
    'storage.googleapis.com',
  );
});
