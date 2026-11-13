/**
 * The theme switch repaints everything, live. Three ways it has failed, each guarded here:
 *
 * 1. A role token set by one theme and not the other keeps the old theme's value after a switch.
 * 2. A `[data-theme='dark'] .thing` rule also reaches a paper sheet or a sand block inside the dark
 *    theme, painting dark-theme colors on a light ground (the confidence marks did). Color by
 *    role token instead, which every ground re-points; only full-surface layers that sit on the
 *    table itself, never inside a ground, may key on the theme.
 * 3. A map whose style is built once keeps the old plate (MapStage and RecordMap rebuild on a
 *    `data-theme` change).
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = readFileSync(join(src, '../../../packages/ui/src/styles/tokens.css'), 'utf8');

function block(selectorStart: string): string {
  const start = tokens.indexOf(selectorStart);
  assert.ok(start >= 0, `tokens.css has no block starting ${selectorStart}`);
  return tokens.slice(start, tokens.indexOf('\n}', start));
}

const names = (css: string) =>
  new Set([...css.matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1]));

test('the light and dark role blocks define exactly the same tokens', () => {
  const light = names(block(":root,\n[data-theme='light'],\n[data-ground='paper']"));
  const dark = names(block("[data-theme='dark'],\n[data-ground='ink'] {\n  color-scheme: dark;"));
  assert.deepEqual(
    [...light].filter((n) => !dark.has(n)),
    [],
    'set in light only',
  );
  assert.deepEqual(
    [...dark].filter((n) => !light.has(n)),
    [],
    'set in dark only',
  );
});

const SURFACE_LAYERS = /^\.ds-(map-stage|edition-atmosphere|map-names-wall)/;

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'admin') cssFiles(full, out);
    } else if (full.endsWith('.css')) out.push(full);
  }
  return out;
}

test('no public rule keys a component on the theme instead of its ground', () => {
  const offenders: string[] = [];
  for (const file of cssFiles(src)) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/\[data-theme='(?:dark|light)'\]\s+([^{,]+)[{,]/g)) {
      if (!SURFACE_LAYERS.test(match[1]!.trim())) {
        offenders.push(`${relative(src, file)}: ${match[0].trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('both maps rebuild their style when the theme changes', () => {
  for (const file of ['components/map-stage/MapStage.tsx', 'components/map-embed/RecordMap.tsx']) {
    const source = readFileSync(join(src, file), 'utf8');
    assert.match(source, /attributeFilter: \['data-theme'\]/, file);
  }
  // A switch made while tiles load must wait for the map, not be dropped.
  assert.match(
    readFileSync(join(src, 'components/map-stage/MapStage.tsx'), 'utf8'),
    /if \(!map\.isStyleLoaded\(\)\) \{\s*map\.once\('idle', syncPlateToTheme\);/,
  );
});
