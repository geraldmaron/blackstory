/**
 * Unit tests for entity mast photo URL fallback candidates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEntityMastImageCandidates } from './entity-mast-image-candidates';

test('empty URL yields no candidates', () => {
  assert.deepEqual(buildEntityMastImageCandidates(''), []);
  assert.deepEqual(buildEntityMastImageCandidates('   '), []);
});

test('non-primary URLs stay single-candidate', () => {
  const url = 'https://cdn.example/entities/ent_x/hero.jpg';
  assert.deepEqual(buildEntityMastImageCandidates(url), [url]);
});

test('GCS primary.jpg tries png and webp next', () => {
  const url =
    'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_x/primary.jpg';
  const candidates = buildEntityMastImageCandidates(url);
  assert.equal(candidates[0], url);
  assert.ok(candidates.includes(url.replace(/\.jpg$/i, '.png')));
  assert.ok(candidates.includes(url.replace(/\.jpg$/i, '.webp')));
  assert.equal(new Set(candidates).size, candidates.length);
});

test('GCS primary.png tries jpg before webp', () => {
  const url =
    'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_x/primary.png';
  const candidates = buildEntityMastImageCandidates(url);
  assert.deepEqual(candidates.slice(0, 3), [
    url,
    url.replace(/\.png$/i, '.jpg'),
    url.replace(/\.png$/i, '.webp'),
  ]);
});
