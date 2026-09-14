/**
 * Explore enter-motion contract (repo-mtk9g): `explore.css` must not carry animation rules keyed
 * on `.ds-explore-stage--entering`, and nothing in `apps/web/src` may set that class.
 *
 * The sheet used to hold `ds-explore-panel-enter` keyframes plus `--entering` rules that faded the
 * instrument and results panels in. They were the last fragment of the hero-dissolve transition
 * contract recorded in `docs/decisions-carryover.md` ("Persistent map canvas"), and that contract
 * did not survive: `HomeMapHero`, `ExploreMapExperience` and `ExploreMapCanvas` are gone, `/` is
 * the Door, `/explore` is the Instrument (`.ds-atlas`), and the `.ds-explore-stage` root the rules
 * keyed off is not rendered anywhere. So the rules could never fire, while still reading as a live
 * motion contract to anyone grepping the sheet. They were deleted rather than rewired, because
 * wiring them would mean inventing a state on markup that no longer exists.
 *
 * Both halves of the guard matter. If the rules come back with nothing setting the class, the
 * sheet is lying again. If the class comes back, re-adding the fade is a deliberate design call:
 * bring the rules back with it and delete this guard, minding the reason the page-level enter
 * animation went away: `animation-fill-mode: both` leaves a non-`none` computed transform behind,
 * and that transform is what made a page wrapper the containing block for the fixed map plate, so
 * the plate scrolled with the document instead of holding the viewport.
 *
 * Scope note: the rest of the `.ds-explore-stage` family (`--hidden`, `--dimmed`, the stage root
 * itself) is unset today too. Retiring all of it is a larger call than this guard makes, and
 * several of those rules are pinned by `shell-layout.test.ts`.
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
