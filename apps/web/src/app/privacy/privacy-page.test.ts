/**
 * Privacy is a walk room for the BlackStory website. No leftover product names.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'PrivacySections.tsx'), 'utf8');

test('privacy is a room on the walk, with the shared way back', () => {
  assert.match(pageSource, /WalkOffRamp/);
  assert.doesNotMatch(pageSource, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(pageSource, /['"`]\/banned-books/);
  assert.doesNotMatch(pageSource, /['"`]\/locate['"`]|['"`]\/design-system/);
});

test('privacy is BlackStory on the website, not a leftover product', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.match(source, /BlackStory/);
    assert.doesNotMatch(source, /blackbook\.app/);
    assert.doesNotMatch(source, /app store|App Store|Play Console|native reader|Mobile app/i);
    assert.doesNotMatch(source, /iOS|Android|IDFA|GAID|X-BlackStory-Client/);
    assert.doesNotMatch(source, /Zooniverse|Caesar|rights-cleared|ent_/);
    assert.doesNotMatch(source, /—/);
  }
});

test('privacy names the published site, not a store or a second product', () => {
  assert.match(sectionsSource, /blackstory\.app/);
  assert.doesNotMatch(sectionsSource, /developer agreements/);
});
