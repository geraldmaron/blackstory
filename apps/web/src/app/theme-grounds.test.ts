/**
 * The theme switch repaints everything, live. Four ways it has failed, each guarded here:
 *
 * 1. A role token set by one theme and not the other keeps the old theme's value after a switch.
 * 2. A `[data-theme='dark'] .thing` rule also reaches a paper sheet or a sand block inside the dark
 *    theme, painting dark-theme colors on a light ground (the confidence marks did). Color by
 *    role token instead, which every ground re-points; only full-surface layers that sit on the
 *    table itself, never inside a ground, may key on the theme.
 * 3. A map whose style is built once keeps the old plate (MapStage and RecordMap rebuild on a
 *    `data-theme` change).
 * 4. See the light-table test below.
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

/*
 * 4. An ink ground that stays black on the light table (the header and the ink blocks did). On the
 *    light table it takes the light roles on a paper step, by one selector in tokens.css; the two
 *    a plate that carries meaning as ink opts out with `data-ground-fixed` (a map exhibit).
 */
test('on the light table an ink ground is paper, unless it is fixed', () => {
  const flip = ":root:not([data-theme='dark']) [data-ground='ink']:not([data-ground-fixed])";
  assert.ok(tokens.includes(`[data-ground='sand'],\n${flip} {\n  color-scheme: light;`), 'roles');
  assert.ok(
    tokens.includes(`[data-ground='sand'],\n${flip} {\n  --ds-lockup-on-light: block;`),
    'lockup artwork',
  );
  const own = block(`${flip} {\n  --ds-canvas`);
  assert.match(own, /--ds-canvas: var\(--ds-material-table\);/);
  // Small type in the soft numeral color steps to copper text there; copper pin is 3.5:1.
  assert.match(own, /--ds-numeral-soft-text: var\(--ds-accent\);/);
  // Archive Paper: the paper step contrast.test.ts measures ink, stone and copper text on.
  assert.match(tokens, /--ds-material-table: #f4efe5;/);
  // The opt-out is the kit's map exhibit, which stays ink in both themes (DESIGN.md section 7.3).
  assert.match(
    readFileSync(join(src, '../../../packages/ui/src/components/Exhibit.tsx'), 'utf8'),
    /data-ground-fixed/,
  );
});

// The record embeds draw the same plate as the map stage, so they key on the theme the same way.
const SURFACE_LAYERS = /^\.ds-(map-stage|record-map|edition-atmosphere|map-names-wall)/;

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
