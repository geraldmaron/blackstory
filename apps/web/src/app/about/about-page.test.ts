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
  ABOUT_ROOMS_HANDOFF,
  ABOUT_SOURCE_LIBRARY_HANDOFF,
  ABOUT_STANCE,
} from './about-copy';
import { MAKER } from '@repo/config';

const here = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(join(here, 'AboutSections.tsx'), 'utf8');
const cssSource = readFileSync(join(here, 'about-page.css'), 'utf8');

test('about page does not mount the retired v6 mast or mosaic chrome', () => {
  assert.doesNotMatch(sectionsSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(sectionsSource, /ABOUT_EDITION_MOSAIC_SEED/);
  assert.doesNotMatch(sectionsSource, /AboutMosaicMast/);
  assert.doesNotMatch(sectionsSource, /LivingAtmosphereMosaic/);
});

test('the page explains the project in the maker voice before it states any rule', () => {
  // The origin section is the reason this room exists; a reader meets the person before the policy.
  assert.ok(ABOUT_ORIGIN.length >= 3, 'the origin section is more than a strapline');
  assert.match(sectionsSource, /ABOUT_ORIGIN/);
  const body = sectionsSource.slice(sectionsSource.indexOf('export function AboutSections'));
  assert.ok(body.indexOf('ABOUT_ORIGIN') < body.indexOf('ABOUT_STANCE'), 'origin precedes stance');
  assert.ok(
    body.indexOf('ABOUT_STANCE') < body.indexOf('ABOUT_PILLARS'),
    'stance precedes the rules',
  );
});

test('the page invites contribution, not only reading', () => {
  assert.match(sectionsSource, /ABOUT_CONTRIBUTE/);
  assert.match(sectionsSource, /take-part/);
  // The terms have to be on the page: "reviewed, not published on arrival" is the promise that
  // makes submitting safe to do, and burying it in /submit asks for trust before explaining it.
  assert.ok(ABOUT_CONTRIBUTE.terms.length > 0);
});

test('the page states what the archive refuses to do', () => {
  assert.ok(ABOUT_REFUSALS.length >= 4, 'refusals are a section, not an aside');
  assert.match(sectionsSource, /ABOUT_REFUSALS/);
});

test('contribution cards come from the registry; the room catalogue hands off to /rooms', () => {
  assert.match(sectionsSource, /destinationsInGroup\('take-part'\)/);
  assert.match(sectionsSource, /cardTitleFor/);
  assert.match(sectionsSource, /DestinationIcon/);
  assert.match(sectionsSource, /ABOUT_ROOMS_HANDOFF/);
  assert.equal(ABOUT_ROOMS_HANDOFF.href, '/rooms');
  assert.doesNotMatch(sectionsSource, /readRooms|checkRooms|\[\.\.\.readRooms/);
  // The old page hardcoded six links, two of them into `/history`, which is a redirect endpoint.
  assert.doesNotMatch(sectionsSource, /href="\/history"/);
  assert.doesNotMatch(sectionsSource, /ABOUT_DESTINATIONS/);
});

test('no list is numbered: neither the pillars nor the refusals are a sequence', () => {
  assert.doesNotMatch(sectionsSource, /padStart\(2, '0'\)/);
  assert.doesNotMatch(cssSource, /__pillar-index|__mission-index/);
});

test('every multi-column rule is inside a min-width query', () => {
  // Guards the defect this rewrite fixed: three columns of prose held down to 375px.
  const beforeFirstQuery = cssSource.split('@media')[0] ?? '';
  assert.doesNotMatch(beforeFirstQuery, /grid-template-columns:\s*repeat\(/);
});

test('about links to the source library room', () => {
  assert.match(sectionsSource, /ABOUT_SOURCE_LIBRARY_HANDOFF/);
  assert.equal(ABOUT_SOURCE_LIBRARY_HANDOFF.href, '/sources');
  assert.equal(ABOUT_SOURCE_LIBRARY_HANDOFF.label, 'Where the evidence comes from');
  assert.doesNotMatch(sectionsSource, /href="\/methodology#where-the-evidence-comes-from"/);
});

test('about sections are deep-linkable through a jump nav', () => {
  assert.match(sectionsSource, /RoomJump/);
  assert.match(sectionsSource, /id: 'stance'/);
  assert.match(sectionsSource, /id: 'pillars'/);
  assert.match(sectionsSource, /id: 'refusals'/);
  assert.match(sectionsSource, /id="origin"/);
  assert.match(sectionsSource, /id="stance"/);
  assert.match(sectionsSource, /RoomSection/);
});

test('about pillars and jump nav carry orientation glyphs', () => {
  for (const pillar of ABOUT_PILLARS) {
    assert.ok(pillar.icon, `${pillar.kicker} carries a pillar glyph`);
  }
  assert.match(sectionsSource, /RoomFactList/);
  assert.match(sectionsSource, /RoomJump/);
  assert.match(sectionsSource, /icon="source"/);
});

test('about is a room on the walk, not the old board', () => {
  assert.doesNotMatch(sectionsSource, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(sectionsSource, /The Atlas answers where and when/);
  assert.doesNotMatch(sectionsSource, /Banned books/);
  assert.doesNotMatch(sectionsSource, /['"`]\/banned-books/);
  assert.doesNotMatch(sectionsSource, /Mosaic credits|ATMOSPHERE_ATTRIBUTION|mosaic-credits/);
  assert.match(sectionsSource, /WalkOffRamp/);
  assert.match(sectionsSource, /ABOUT_ORIGIN/);
  assert.match(sectionsSource, /ABOUT_PILLARS/);
  assert.match(sectionsSource, /ABOUT_REFUSALS/);
});

test('the page discloses how the long-form writing is made, including the AI use', () => {
  // The disclosure is the point of the section: a reader who finds out elsewhere that the prose
  // is drafted with AI has been misled by this page's silence. It also has to state the limit,
  // because "AI writes it" without "AI cannot lower the evidence bar" is the wrong half.
  assert.match(sectionsSource, /ABOUT_NEO/);
  const neo = [...ABOUT_NEO.rules, ...ABOUT_NEO.human, ABOUT_NEO.hand].join(' ');
  assert.match(neo, /\bAI\b/, 'the section says plainly that AI is used');
  assert.match(neo, /neo-voice\.md/, 'the voice document is named, so the claim is checkable');
  assert.match(neo, /evidence gate/, 'the section states the bar the voice cannot move');
  assert.match(neo, /not a generated image/, 'the hand-drawn cover commitment is stated');
  // Measured in the rendered body, not in the file. The import block is alphabetised, so
  // ABOUT_NEO always precedes ABOUT_ORIGIN there and an indexOf over the whole source would
  // report the opposite of what the page actually renders.
  const body = sectionsSource.slice(sectionsSource.indexOf('export function AboutSections'));
  assert.ok(
    body.indexOf('ABOUT_NEO') > body.indexOf('ABOUT_ORIGIN'),
    'the person comes before the machinery',
  );
});

test('the stance names how the archive is meant, and does not hide who assembled it', () => {
  assert.match(sectionsSource, /ABOUT_STANCE/);
  assert.equal(ABOUT_STANCE.maker.href, MAKER.url);
  const stance = [
    ...ABOUT_STANCE.paragraphs,
    ABOUT_STANCE.maker.lead,
    ABOUT_STANCE.maker.label,
  ].join(' ');
  assert.match(stance, /anti-white/);
  assert.doesNotMatch(stance, /anti-Black/);
  assert.match(stance, /opinion/);
  assert.match(stance, /product manager/);
  assert.equal(ABOUT_STANCE.maker.label, 'geralddagher.com');
});

test('nothing on this page speaks as an institutional "we"', () => {
  // One person runs this. A first-person plural on the about page is the one lie a reader can
  // catch immediately, and it was there in the off-ramp ("an identity with us").
  const strings = [
    ...ABOUT_ORIGIN,
    ...ABOUT_STANCE.paragraphs,
    ABOUT_STANCE.maker.lead,
    ABOUT_STANCE.maker.label,
    ...ABOUT_REFUSALS,
    ...ABOUT_NEO.rules,
    ...ABOUT_NEO.human,
    ABOUT_NEO.hand,
    ABOUT_CONTRIBUTE.lede,
    ABOUT_CONTRIBUTE.terms,
    ABOUT_CONTRIBUTE.direct,
    ABOUT_ROOMS_HANDOFF.lede,
    ABOUT_ROOMS_HANDOFF.label,
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
    ABOUT_ROOMS_HANDOFF.lede,
    ABOUT_ROOMS_HANDOFF.label,
    ABOUT_STANCE.heading,
    ...ABOUT_STANCE.paragraphs,
    ABOUT_STANCE.maker.lead,
    ABOUT_STANCE.maker.label,
    ...ABOUT_PILLARS.flatMap((pillar) => [pillar.kicker, pillar.title, pillar.body]),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
});
