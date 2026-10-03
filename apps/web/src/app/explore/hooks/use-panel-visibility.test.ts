/**
 * Explore opens with its instruments on screen. The defaults live in both the `useState` seed and
 * the viewport `sync` effect that runs after mount, so this test pins both sources of truth.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const hook = readFileSync(
  fileURLToPath(new URL('./use-panel-visibility.ts', import.meta.url)),
  'utf8',
);
const experience = readFileSync(
  fileURLToPath(new URL('../AtlasExperience.tsx', import.meta.url)),
  'utf8',
);

/** The `useState<PanelVisibility>({ ... })` seed, as written. */
function mountSeed(): string {
  const match = hook.match(/useState<PanelVisibility>\(\{([\s\S]*?)\}\)/);
  assert.ok(match, 'panel visibility seed not found');
  return match[1] ?? '';
}

/** The body of the `sync` effect's `setPanels({ ... })` call. */
function viewportSync(): string {
  const match = hook.match(
    /const sync = \(\) => \{[\s\S]*?setPanels\(\(current\) => \(\{([\s\S]*?)\}\)\);/,
  );
  assert.ok(match, 'viewport sync setPanels not found');
  return match[1] ?? '';
}

test('Lens, Results, and Time seed open; Camera stays restored-on-demand', () => {
  const seed = mountSeed();
  for (const panel of ['lens', 'results', 'decade']) {
    assert.match(seed, new RegExp(`${panel}: true,`), `${panel} must seed open`);
  }
  assert.match(seed, /camera: false/);
});

test('compact viewports open map-first; wider ones open the Lens', () => {
  const sync = viewportSync();
  assert.match(sync, /lens: !isNarrow,/, 'Lens opens wherever there is room beside the map');
});

test('Records open only when both side panels fit; Time opens whenever not compact', () => {
  const sync = viewportSync();
  assert.match(sync, /results: !isNarrow && !isMid,/);
  assert.match(sync, /decade: !isNarrow,/);
  assert.match(sync, /camera: isNarrow \? false : current\.camera/);
});

test('compact is narrow OR short, from the one shared definition', () => {
  assert.match(hook, /window\.matchMedia\(COMPACT_MEDIA_QUERY\)/);
});

test('the Lens is gated only on its panel flag, hidden chrome, and Atlas mode', () => {
  assert.match(experience, /const showLens = panels\.lens && !chromeHidden && mode === 'atlas';/);
});

test('mode starts as atlas so the Lens can show', () => {
  assert.match(hook, /useState<AtlasMode>\('atlas'\)/);
});

test('narrow Filters is not a modal: the visible map stays operable', () => {
  assert.doesNotMatch(experience, /modal=\{narrow\}/);
  assert.match(experience, /escapeDismiss=\{narrow\}/);
});
