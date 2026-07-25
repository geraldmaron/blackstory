/**
 * `/stories/[slug]` bound-story redirect: theme-bound stories permanently redirect
 * to their theme's chaptered essay anchor; unbound stories render unchanged.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');

test('bound stories permanently redirect to the theme chapter anchor before rendering', () => {
  assert.match(pageSource, /import\s*\{\s*notFound,\s*permanentRedirect\s*\}\s*from 'next\/navigation'/);
  assert.match(pageSource, /if \(story\.themeBinding\) \{/);
  assert.match(
    pageSource,
    /permanentRedirect\(\s*`\/themes\/\$\{story\.themeBinding\.themeId\}#chapter-\$\{story\.themeBinding\.chapterIndex\}`,?\s*\);/,
  );
});

test('the themeBinding redirect check runs before related-entity lookup and article render', () => {
  const redirectIndex = pageSource.indexOf('if (story.themeBinding)');
  const relatedEntitiesIndex = pageSource.indexOf('listPublicEntityViewsByIds(story.relatedEntityIds)');
  assert.ok(redirectIndex >= 0, 'expected themeBinding redirect check');
  assert.ok(relatedEntitiesIndex >= 0, 'expected related-entities lookup');
  assert.ok(redirectIndex < relatedEntitiesIndex, 'redirect must be checked before article data is loaded');
});

test('unbound-story article rendering is untouched: intro, body, records, sources beats remain', () => {
  assert.match(pageSource, /storiesEditionPanelClassName\('intro'\)/);
  assert.match(pageSource, /storiesEditionPanelClassName\('body'\)/);
  assert.match(pageSource, /storiesEditionPanelClassName\('sources'\)/);
});
