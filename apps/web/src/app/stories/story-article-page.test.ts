/**
 * Story article page layout: v6 edition beat order and related-entities placement.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');

function panelBeatIndex(variant: string): number {
  const marker = `storiesEditionPanelClassName('${variant}')`;
  const index = pageSource.indexOf(marker);
  assert.ok(index >= 0, `expected ${marker} in story article page`);
  return index;
}

test('story article DOM order: intro, body, related entities, sources', () => {
  const intro = panelBeatIndex('intro');
  const body = panelBeatIndex('body');
  const records = panelBeatIndex('records');
  const sources = panelBeatIndex('sources');

  assert.ok(intro < body, 'intro mast must precede article body');
  assert.ok(body < records, 'article body must precede related entities panel');
  assert.ok(records < sources, 'related entities must precede sources panel');
});

test('story article keeps related entities in single-column stack', () => {
  assert.doesNotMatch(pageSource, /aside|sidebar|rail-column|two-column/i);
  assert.match(pageSource, /ds-story-rail/);
});
