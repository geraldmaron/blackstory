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

test('the viewport sync keeps the Lens open at every width', () => {
  const sync = viewportSync();
  assert.match(sync, /lens: true,/, 'Lens must stay open on narrow viewports too');
  assert.doesNotMatch(sync, /lens: !isNarrow/);
  assert.doesNotMatch(sync, /lens: false/);
});

test('the viewport sync opens Results and Time on a wide viewport', () => {
  const sync = viewportSync();
  for (const panel of ['results', 'decade']) {
    assert.match(sync, new RegExp(`${panel}: !isNarrow,`), `${panel} must open when wide`);
  }
  assert.match(sync, /camera: isNarrow \? false : current\.camera/);
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
