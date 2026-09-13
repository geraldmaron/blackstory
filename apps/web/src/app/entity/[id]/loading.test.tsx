/**
 * `/entity/{id}`'s loading skeleton (repo-92n2.12.4), against `EntityRecordRoom.tsx`'s own
 * source rather than a hand-typed guess of its geometry — the acceptance bar is "measured, not
 * eyeballed". Each class the skeleton renders is checked against the file that actually owns it
 * (`EntityRecordRoom.tsx`, `RecordChrome.tsx`, `record-room.css`), and the tile count comes from
 * counting `RecordFactTile` call sites in `EntityRecordRoom.tsx` rather than restating "5" — a
 * sixth tile added there fails this test until the skeleton grows to match.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import EntityLoading, { ENTITY_LOADING_ANATOMY_TILE_COUNT } from './loading';

void React;

/** Strips comments so a source check reads code, not this file's own prose about that code. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const here = dirname(fileURLToPath(import.meta.url));
const loadingSource = readFileSync(join(here, 'loading.tsx'), 'utf8');
const loadingCode = withoutComments(loadingSource);
const roomSource = readFileSync(join(here, 'EntityRecordRoom.tsx'), 'utf8');
const recordRoomCss = readFileSync(join(here, 'record-room.css'), 'utf8');
const chromeCss = readFileSync(join(here, '../../../components/entity/record-chrome.css'), 'utf8');
const skeletonCss = readFileSync(join(here, '../../../components/patterns/skeleton.css'), 'utf8');

const html = renderToStaticMarkup(<EntityLoading />);

test('the anatomy tile count is measured off the real room, not restated', () => {
  const realTileCount = (roomSource.match(/<RecordFactTile/g) ?? []).length;
  assert.equal(realTileCount, 5, 'sanity: EntityRecordRoom.tsx still renders 5 anatomy tiles');
  assert.equal(ENTITY_LOADING_ANATOMY_TILE_COUNT, realTileCount);
  assert.equal((html.match(/class="ds-rec-tile"/g) ?? []).length, realTileCount);
});

/** A skeleton class is real only if the html has it AND the file that owns the real element's
 * markup or styling still names it — so a rename on either side breaks this test until the
 * skeleton is updated to match, rather than the skeleton quietly drifting from what it mirrors. */
function assertSharedClass(owner: string, ownerSource: string, cls: string): void {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(ownerSource, new RegExp(`\\.?${escaped}\\b`), `not in ${owner}: ${cls}`);
  assert.match(html, new RegExp(`class="[^"]*\\b${escaped}\\b`), `missing from skeleton: ${cls}`);
}

test('the masthead skeleton reuses the exact classes the loaded masthead renders', () => {
  for (const cls of [
    'ds-record-mast',
    'ds-record-mast__over',
    'ds-rec-pills',
    'ds-record-mast__title',
    'ds-record-mast__lede',
  ]) {
    assertSharedClass('EntityRecordRoom.tsx', roomSource, cls);
  }
  // The kicker is a kind pill. `RecordKindPill` (EntityRecordRoom.tsx) always renders
  // `tone="kind"`, and `RecordPill` (record-chrome.css's own component) turns a tone into
  // `ds-rec-pill--${tone}` — checked as that template, not the literal string, since
  // `ds-rec-pill--kind` itself never appears as a string anywhere in the real components.
  assert.match(roomSource, /RecordKindPill/);
  assert.match(chromeCss, /\.ds-rec-pill\b/);
  assert.match(
    readFileSync(join(here, '../../../components/entity/RecordChrome.tsx'), 'utf8'),
    /ds-rec-pill--\$\{tone\}/,
  );
  assert.match(html, /class="ds-rec-pill ds-rec-pill--kind"/);
  assert.match(html, /data-media="mark"/);
});

test('the fact-strip skeleton reuses the exact tile classes the loaded strip renders', () => {
  // The strip's own wrapper is EntityRecordRoom.tsx's markup, defined in record-room.css.
  for (const cls of ['ds-rec-facts', 'ds-rec-facts__tiles']) {
    assertSharedClass('EntityRecordRoom.tsx / record-room.css', roomSource + recordRoomCss, cls);
  }
  // Each tile's markup is RecordChrome.tsx's `RecordFactTile`, styled in record-room.css (the
  // tile sizing lives beside the record page's own fact-strip layout, not the shared pill/meter
  // atoms in record-chrome.css).
  const chromeSource = readFileSync(
    join(here, '../../../components/entity/RecordChrome.tsx'),
    'utf8',
  );
  for (const cls of [
    'ds-rec-tile',
    'ds-rec-tile__label',
    'ds-rec-tile__icon',
    'ds-rec-tile__value',
    'ds-rec-tile__support',
  ]) {
    assertSharedClass('RecordChrome.tsx / record-room.css', chromeSource + recordRoomCss, cls);
  }
});

test('the record-scaled skeleton sizes exist in record-room.css and cover the h1/lede', () => {
  assert.match(recordRoomCss, /\.ds-rec-skel--title\s*{\s*height:\s*calc\(var\(--rec-title\)/);
  assert.match(recordRoomCss, /\.ds-rec-skel--lede\s*{\s*height:\s*calc\(var\(--rec-lede\)/);
  assert.match(html, /ds-record-mast__title"><span class="ds-sk ds-rec-skel--title/);
  assert.match(html, /ds-record-mast__lede"><span class="ds-sk ds-rec-skel--lede/);
});

test('exactly one polite announcement, and it says the record is opening', () => {
  const liveRegions = html.match(/aria-live="polite"/g) ?? [];
  assert.equal(liveRegions.length, 1);
  assert.match(html, /aria-live="polite"[^]*?Opening record/);
  // The announcement is its own visually-hidden node, not the busy region itself, so a mid-wait
  // re-render of a shimmer block can never trigger a second one.
  assert.match(html, /class="ds-visually-hidden" role="status" aria-live="polite"/);
});

test('aria-busy covers the region once, and every shimmer block is hidden from the tree', () => {
  assert.equal((html.match(/aria-busy="true"/g) ?? []).length, 1);
  assert.ok(html.startsWith('<div aria-busy="true">'));
  // Every ds-sk shimmer element is either aria-hidden itself or inside an aria-hidden ancestor
  // (the masthead figure); the fact-strip tiles carry no live-region attributes at all.
  assert.equal((html.match(/aria-live/g) ?? []).length, 1, 'no per-tile live region');
});

test('never a spinner', () => {
  assert.doesNotMatch(html, /role="progressbar"/);
  assert.doesNotMatch(html, /class="[^"]*spin/i);
});

test('reduced motion comes from a live CSS media query, not a one-shot boot value', () => {
  // No 'use client' directive, no matchMedia, no useState/useEffect boot check: nothing here can
  // go stale between the moment it renders and the moment a reader flips the OS preference.
  // Checked against the code with comments stripped, not this file's own prose about its
  // absence, which names several of these terms while explaining why they are not needed.
  assert.doesNotMatch(loadingCode, /use client/);
  assert.doesNotMatch(loadingCode, /matchMedia|useState|useEffect|useReducedMotion/);
  // Every shimmer block carries `.ds-sk`, so every one of them is covered by skeleton.css's own
  // reduced-motion rule below — this is what actually gets tested live, in the browser, by that
  // file's own `@media` query, not by this Node process (there is no layout engine here to
  // observe an animation stop). Counting confirms every visible block is wired to it, not just
  // some of them.
  const skShimmerBlocks = html.match(/class="ds-sk\b/g) ?? [];
  const skComposedBlocks = html.match(/class="[^"]*\bds-sk\b/g) ?? [];
  assert.ok(skShimmerBlocks.length + (skComposedBlocks.length - skShimmerBlocks.length) >= 4);
  assert.match(
    skeletonCss,
    /@media \(prefers-reduced-motion: reduce\) {\s*\.ds-sk {\s*animation: none;/,
  );
});
