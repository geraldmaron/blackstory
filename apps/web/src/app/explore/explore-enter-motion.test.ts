/**
 * Explore enter-motion contract: `explore.css` must not carry animation rules keyed
 * on `.ds-explore-stage--entering`, and nothing in `apps/web/src` may set that class.
 *
 * The current Door and Instrument markup never emits `.ds-explore-stage--entering`. Keeping CSS
 * keyed to that absent state would describe a motion contract the product cannot run.
 *
 * Both halves of the guard matter. If the rules come back with nothing setting the class, the
 * sheet is lying. If the class appears, any matching animation must avoid a retained transform:
 * `animation-fill-mode: both` can make a page wrapper the containing block for the fixed map plate
 * and cause the plate to scroll with the document.
 *
 * This guard covers only enter motion. `shell-layout.test.ts` owns the other
 * `.ds-explore-stage` rules.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exploreCss = readFileSync(join(here, 'explore.css'), 'utf8');
const webSrc = join(here, '../..');

/** Every shipped TS/TSX source under `apps/web/src`. Tests name classes; they never set them. */
function shippedSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(join(dir, entry));
  }
  return out;
}

describe('Explore enter motion', () => {
  it('keeps no rules keyed on the retired --entering state', () => {
    assert.doesNotMatch(exploreCss, /ds-explore-stage--entering/);
    assert.doesNotMatch(exploreCss, /ds-explore-panel-enter/);
  });

  it('agrees with the markup, which never sets that state', () => {
    const sources = shippedSources(webSrc);
    assert.ok(
      sources.length > 100,
      `expected the web source scan to find files, got ${sources.length}`,
    );

    const setters = sources
      .filter((file) => readFileSync(file, 'utf8').includes('ds-explore-stage--entering'))
      .map((file) => relative(webSrc, file));
    assert.deepEqual(
      setters,
      [],
      'the retired Explore enter state is back in the markup; read the header of this file before re-adding the CSS',
    );
  });
});
