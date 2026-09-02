/**
 * Explore opens with its instruments on screen. This contract has flipped three times
 * (2026-08-29 twice, 2026-09-01, 2026-09-02): "first paint is the map" commits keep collapsing
 * every panel at mount, and the reader lands on a bare plate with no filters — the complaint
 * recorded in the hook's own comment. The defaults live in two places (the `useState` seed and
 * the viewport `sync` effect that overwrites it after mount), so both are pinned here.
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
  const match = hook.match(/const sync = \(\) => \{[\s\S]*?setPanels\(\{([\s\S]*?)\}\);/);
  assert.ok(match, 'viewport sync setPanels not found');
  return match[1] ?? '';
}

test('every instrument is open at mount (server render is the wide layout)', () => {
  const seed = mountSeed();
  for (const panel of ['lens', 'results', 'decade', 'camera']) {
    assert.match(seed, new RegExp(`${panel}: true,`), `${panel} must seed open`);
  }
});

test('the viewport sync keeps the Lens open at every width', () => {
  const sync = viewportSync();
  assert.match(sync, /lens: true,/, 'Lens must stay open on narrow viewports too');
  assert.doesNotMatch(sync, /lens: !isNarrow/);
  assert.doesNotMatch(sync, /lens: false/);
});

test('the viewport sync opens the other three instruments on a wide viewport', () => {
  const sync = viewportSync();
  for (const panel of ['results', 'decade', 'camera']) {
    assert.match(sync, new RegExp(`${panel}: !isNarrow,`), `${panel} must open when wide`);
    assert.doesNotMatch(sync, new RegExp(`${panel}: false`));
  }
});

test('the Lens is gated only on its panel flag, hidden chrome, and Atlas mode', () => {
  assert.match(experience, /const showLens = panels\.lens && !chromeHidden && mode === 'atlas';/);
});

test('mode starts as atlas so the Lens can show', () => {
  assert.match(hook, /useState<AtlasMode>\('atlas'\)/);
});
