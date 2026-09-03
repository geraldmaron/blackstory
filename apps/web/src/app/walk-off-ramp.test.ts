/**
 * The back control is BlackStory at `/`, never a featured library name.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAP_BACK } from './walk-back-place';
import { WalkOffRampView } from './walk-off-ramp';

const here = dirname(fileURLToPath(import.meta.url));

test('the copper back control is BlackStory', () => {
  const html = renderToStaticMarkup(
    createElement(WalkOffRampView, {
      placeName: MAP_BACK.displayName,
      href: MAP_BACK.href,
      children: 'Every number here is a national series.',
    }),
  );
  assert.match(html, />BlackStory</);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, />The map</);
  assert.doesNotMatch(html, /African American Research Library and Cultural Center/);
  assert.doesNotMatch(html, /The place|door back|sit-script|Open the Atlas/i);
});

test('walk rooms do not hardcode The place or door-back protocol copy', () => {
  const files = [
    'walk-off-ramp.tsx',
    'walk-back-place.ts',
    'about/page.tsx',
    'data/page.tsx',
    'data/data-copy.ts',
    'data/DataSections.tsx',
    'methodology/MethodologySections.tsx',
    'errata/page.tsx',
    'memorial/page.tsx',
    'stories/page.tsx',
    'law/page.tsx',
    'submit/page.tsx',
    'corrections/CorrectionsSections.tsx',
    'support/page.tsx',
    'rooms/page.tsx',
    'privacy/page.tsx',
    'privacy/PrivacySections.tsx',
    'books/page.tsx',
    'books/[slug]/page.tsx',
  ];
  for (const relative of files) {
    const source = readFileSync(join(here, relative), 'utf8');
    assert.doesNotMatch(
      source,
      /['"`]The place['"`]|The place is the door back|label: 'The place'/,
      `${relative} must not use a sit-script back label`,
    );
    assert.doesNotMatch(
      source,
      /African American Research Library and Cultural Center/,
      `${relative} must not print the Fort Lauderdale library as the site back`,
    );
  }
});

test('the walk-back constant is BlackStory at the door', () => {
  assert.equal(MAP_BACK.displayName, 'BlackStory');
  assert.equal(MAP_BACK.href, '/');
});
