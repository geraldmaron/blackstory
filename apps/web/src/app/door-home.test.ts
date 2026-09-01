/**
 * The door states what you are walking into and shows the existing pin plate.
 * It is not the Atlas instrument and not a manifesto rewrite.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listPublicEntities } from '../data/public-seed';
import { buildExploreMapSource } from '../lib/map-experience/build-explore-map-source';
import { toFirstPaintPins } from '../lib/map-experience/first-paint-pins';
import { atlasWalkHref } from '../lib/place/public-place-path';
import { ABOUT_LINE, ABOUT_WALK_PAST } from './about/about-copy';
import { FirstPaintPinPlate } from './first-paint-pin-plate';

const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');
const door = readFileSync(fileURLToPath(new URL('./door-home.tsx', import.meta.url)), 'utf8');

test('`/` is the locked about mast plus the existing pin plate', () => {
  assert.match(page, /DoorHome/);
  assert.doesNotMatch(page, /AtlasHome|AtlasLoader|AtlasExperience/);
  assert.doesNotMatch(page, /HomeFirstPaint|wantsAtlasInstrument|atlas=1/);
  assert.match(door, /ABOUT_LINE/);
  assert.match(door, /ABOUT_WALK_PAST/);
  assert.match(door, /FirstPaintPinPlate/);
  assert.match(door, /listPublicEntities/);
  assert.match(door, /BlackStory/);
  assert.match(door, /History, pinned to place/);
  assert.match(door, /Open the Atlas/);
  assert.doesNotMatch(door, /ABOUT_LEDE/);
  assert.doesNotMatch(door, /AtlasLoader|CameraConsole|FilterBar|Journey|Lens|Camera/);
  assert.doesNotMatch(door, /4,101|42Cb1758/);
  assert.doesNotMatch(door, /label: 'Kind'|label: 'Tone'|label: 'Era'/);
  assert.doesNotMatch(door, /buildAtlasShell|explore-view-model/);
  assert.match(door, /buildExploreMapSource/);
  assert.doesNotMatch(door, /['"`]\/banned-books|['"`]\/journey/);
});

test('the brand leads; ABOUT_LINE stays the product sentence', () => {
  assert.equal(
    ABOUT_LINE,
    'BlackStory is a place-connected archive of Black history: people, places, and events pinned to where they happened, with the source attached to every claim.',
  );
  assert.match(door, /id="door-brand"/);
  assert.match(door, /id="door-line"/);
  assert.match(door, /\{ABOUT_LINE\}/);
  assert.doesNotMatch(ABOUT_LINE, /\u2014/);
  assert.doesNotMatch(ABOUT_WALK_PAST, /\u2014/);
});

test('the door plate sits in the page, not over the rooms', () => {
  const css = readFileSync(fileURLToPath(new URL('./door-home.css', import.meta.url)), 'utf8');
  assert.match(css, /:has\(\.ds-door\)/);
  assert.match(css, /ds-door__ground/);
  assert.match(css, /position:\s*absolute/);
  assert.match(css, /@media \(max-width: 559px\)/);
  assert.match(css, /@media \(max-width: 559px\)[\s\S]*position:\s*relative/);
  assert.match(css, /position:\s*relative/);
  assert.doesNotMatch(css, /box-shadow|backdrop-filter|linear-gradient/);
});

test('at phone width the door frame and brand wrap rather than clip', () => {
  const css = readFileSync(fileURLToPath(new URL('./door-home.css', import.meta.url)), 'utf8');
  const start = css.lastIndexOf('@media (max-width: 559px)');
  assert.ok(start >= 0, 'phone door block must exist');
  const next = css.indexOf('@media', start + 1);
  const block = next === -1 ? css.slice(start) : css.slice(start, next);
  assert.match(block, /\.ds-door__frame/);
  assert.match(block, /box-sizing:\s*border-box/);
  assert.match(block, /max-width:\s*100%/);
  assert.match(block, /min-width:\s*0/);
  assert.match(block, /width:\s*100%/);
  assert.match(block, /\.ds-door__brand[\s\S]*overflow-wrap:\s*break-word/);
  assert.match(css, /overflow-wrap:\s*break-word/);
  assert.doesNotMatch(css, /overflow-x:\s*clip/);
});

test('the door prints the existing about line, not a rewrite', () => {
  const pins = toFirstPaintPins(
    buildExploreMapSource(listPublicEntities()).featureCollection.features,
  );
  const html = `${ABOUT_LINE}${ABOUT_WALK_PAST}${renderToStaticMarkup(
    createElement(FirstPaintPinPlate, { pins }),
  )}`;
  assert.match(html, /place-connected archive of Black history/);
  assert.match(html, /with the source attached to every claim/);
  assert.match(html, /walk past documented Black history/);
  assert.match(html, /ds-first-paint-plate/);
  assert.match(html, /ds-first-paint-pin--walk/);
  assert.doesNotMatch(html, /42Cb1758|Grade A|ent_/);
  assert.doesNotMatch(html, /dillard-house|james-h-dillard-house/i);
  assert.doesNotMatch(html, /Journey|4,101|Kind|Tone|Era/);
  assert.equal(
    atlasWalkHref({
      displayName: 'Dillard High School, Old',
      kind: 'place',
      entityId: 'nrhp-black-heritage-91000107',
    }),
    '/place/dillard-high-school-old',
  );
});
