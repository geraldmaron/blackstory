/**
 * The back control is the published place name, never a sit-script label.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { WalkOffRampView } from './walk-off-ramp';

const here = dirname(fileURLToPath(import.meta.url));

test('the copper back control is the place display name', () => {
  const html = renderToStaticMarkup(
    createElement(
      WalkOffRampView,
      { placeName: 'African American Research Library and Cultural Center' },
      'Every number here is a national series.',
    ),
  );
  assert.match(html, /African American Research Library and Cultural Center/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /The place|door back|sit-script/i);
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
  ];
  for (const relative of files) {
    const source = readFileSync(join(here, relative), 'utf8');
    assert.doesNotMatch(
      source,
      /['"`]The place['"`]|The place is the door back|label: 'The place'/,
      `${relative} must not use a sit-script back label`,
    );
  }
});
