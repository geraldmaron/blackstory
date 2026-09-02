/**
 * `/about` page wiring: the two voices, the refusals, and destinations that come from the registry.
 *
 * The assertions here are about what the page cannot lose, not about its exact wording. The two
 * that matter most are the last two: a hardcoded destination list is how the old page shipped two
 * links into `/history` after `/history` became a redirect, and numbered markers on a list that is
 * not a sequence is the specific decoration this rewrite removed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ABOUT_CONTRIBUTE,
  ABOUT_NEO,
  ABOUT_ORIGIN,
  ABOUT_PILLARS,
  ABOUT_REFUSALS,
} from './about-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const cssSource = readFileSync(join(here, 'about-page.css'), 'utf8');

test('about page does not mount the retired v6 mast or mosaic chrome', () => {
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(pageSource, /ABOUT_EDITION_MOSAIC_SEED/);
  assert.doesNotMatch(pageSource, /AboutMosaicMast/);
  assert.doesNotMatch(pageSource, /LivingAtmosphereMosaic/);
});

test('the page explains the project in the maker voice before it states any rule', () => {
  // The origin section is the reason this room exists; a reader meets the person before the policy.
  assert.ok(ABOUT_ORIGIN.length >= 3, 'the origin section is more than a strapline');
  assert.match(pageSource, /ABOUT_ORIGIN/);
  const originAt = pageSource.indexOf('ABOUT_ORIGIN');
  const pillarsAt = pageSource.indexOf('ABOUT_PILLARS');
  assert.ok(originAt < pillarsAt, 'the first person section precedes the rules');
});

test('the page invites contribution, not only reading', () => {
  assert.match(pageSource, /ABOUT_CONTRIBUTE/);
  assert.match(pageSource, /take-part/);
  // The terms have to be on the page: "reviewed, not published on arrival" is the promise that
  // makes submitting safe to do, and burying it in /submit asks for trust before explaining it.
  assert.ok(ABOUT_CONTRIBUTE.terms.length > 0);
});

test('the page states what the archive refuses to do', () => {
  assert.ok(ABOUT_REFUSALS.length >= 4, 'refusals are a section, not an aside');
  assert.match(pageSource, /ABOUT_REFUSALS/);
});

test('destinations are generated from the registry, never hardcoded', () => {
  assert.match(pageSource, /destinationsInGroup/);
  assert.match(pageSource, /cardTitleFor/);
  // The old page hardcoded six links, two of them into `/history`, which is a redirect endpoint.
  assert.doesNotMatch(pageSource, /href="\/history"/);
  assert.doesNotMatch(pageSource, /ABOUT_DESTINATIONS/);
});

test('no list is numbered: neither the pillars nor the refusals are a sequence', () => {
  assert.doesNotMatch(pageSource, /padStart\(2, '0'\)/);
  assert.doesNotMatch(cssSource, /__pillar-index|__mission-index/);
});

test('every multi-column rule is inside a min-width query', () => {
  // Guards the defect this rewrite fixed: three columns of prose held down to 375px.
  const beforeFirstQuery = cssSource.split('@media')[0] ?? '';
  assert.doesNotMatch(beforeFirstQuery, /grid-template-columns:\s*repeat\(/);
});

test('about is a room on the walk, not the old board', () => {
  assert.doesNotMatch(pageSource, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(pageSource, /The Atlas answers where and when/);
  assert.doesNotMatch(pageSource, /Banned books/);
  assert.doesNotMatch(pageSource, /['"`]\/banned-books/);
  assert.doesNotMatch(pageSource, /Mosaic credits|ATMOSPHERE_ATTRIBUTION|mosaic-credits/);
  assert.match(pageSource, /WalkOffRamp/);
  assert.match(pageSource, /ABOUT_ORIGIN/);
  assert.match(pageSource, /ABOUT_PILLARS/);
  assert.match(pageSource, /ABOUT_REFUSALS/);
});

test('the page discloses how the long-form writing is made, including the AI use', () => {
  // The disclosure is the point of the section: a reader who finds out elsewhere that the prose
  // is drafted with AI has been misled by this page's silence. It also has to state the limit,
  // because "AI writes it" without "AI cannot lower the evidence bar" is the wrong half.
  assert.match(pageSource, /ABOUT_NEO/);
  const neo = [...ABOUT_NEO.rules, ...ABOUT_NEO.human, ABOUT_NEO.hand].join(' ');
  assert.match(neo, /\bAI\b/, 'the section says plainly that AI is used');
  assert.match(neo, /neo-voice\.md/, 'the voice document is named, so the claim is checkable');
  assert.match(neo, /evidence gate/, 'the section states the bar the voice cannot move');
  assert.match(neo, /not a generated image/, 'the hand-drawn cover commitment is stated');
  // Measured in the rendered body, not in the file. The import block is alphabetised, so
  // ABOUT_NEO always precedes ABOUT_ORIGIN there and an indexOf over the whole source would
  // report the opposite of what the page actually renders.
  const body = pageSource.slice(pageSource.indexOf('export default function'));
  assert.ok(
    body.indexOf('ABOUT_NEO') > body.indexOf('ABOUT_ORIGIN'),
    'the person comes before the machinery',
  );
});

test('nothing on this page speaks as an institutional "we"', () => {
  // One person runs this. A first-person plural on the about page is the one lie a reader can
  // catch immediately, and it was there in the off-ramp ("an identity with us").
  const strings = [
    ...ABOUT_ORIGIN,
    ...ABOUT_REFUSALS,
    ...ABOUT_NEO.rules,
    ...ABOUT_NEO.human,
    ABOUT_NEO.hand,
    ABOUT_CONTRIBUTE.lede,
    ABOUT_CONTRIBUTE.terms,
    ABOUT_CONTRIBUTE.direct,
    ...ABOUT_PILLARS.map((pillar) => pillar.body),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /\b(we|our|ours)\b/i, `institutional plural in: ${value}`);
  }
});

test('user-facing copy avoids em dashes', () => {
  const strings = [
    ...ABOUT_ORIGIN,
    ...ABOUT_REFUSALS,
    ...ABOUT_NEO.rules,
    ...ABOUT_NEO.human,
    ABOUT_NEO.heading,
    ABOUT_NEO.hand,
    ABOUT_CONTRIBUTE.heading,
    ABOUT_CONTRIBUTE.lede,
    ABOUT_CONTRIBUTE.terms,
    ABOUT_CONTRIBUTE.direct,
    ...ABOUT_PILLARS.flatMap((pillar) => [pillar.kicker, pillar.title, pillar.body]),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
});
