/**
 * Terms is a Utility walk room, and it is a notice rather than a contract.
 *
 * The negative assertions are the point of this file. A terms page rots toward boilerplate: the
 * arbitration clause, the venue clause, the indemnity and the "we may change this at any time"
 * line all arrive one paste at a time, each of them inert against a reader who never clicked
 * agree. Asserting their absence is what keeps the page a set of true statements.
 *
 * Prose assertions run against `flat`, the source with runs of whitespace collapsed, so that a
 * reflow by the formatter cannot break a test about what the page says.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { allDestinations, crawlableDestinations } from '../../lib/nav/destination-registry';
import { surfaceClassFor } from '../../lib/nav/surface-classes';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'TermsSections.tsx'), 'utf8');
const flat = sectionsSource.replace(/\s+/g, ' ');

/**
 * The same source with comment lines dropped. The header comment names the clauses this page
 * refuses to carry, so a check for "no arbitration anywhere" has to read the page, not the note
 * explaining why the page has none.
 */
const proseLines = sectionsSource
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/*'));
const proseFlat = proseLines.join('\n').replace(/\s+/g, ' ');

test('terms is a room on the walk, with the shared way back', () => {
  assert.match(pageSource, /WalkOffRamp/);
  assert.match(pageSource, /<TermsSections \/>/);
  assert.match(pageSource, /pathname="\/terms"/);
  assert.doesNotMatch(pageSource, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(pageSource, /['"`]\/design-system/);
});

test('terms is BlackStory on the website, not a leftover product', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.match(source, /BlackStory/);
    assert.doesNotMatch(source, /blackbook\.app/);
    assert.doesNotMatch(source, /—/);
  }
  assert.match(sectionsSource, /blackstory\.app/);
});

test('the operator is a named individual, and the contact is imported', () => {
  assert.match(flat, /Gerald Dagher<\/strong>, an individual\. There is no company behind it\./);
  assert.match(
    sectionsSource,
    /import \{ SUPPORT_CONTACT \} from '\.\.\/\.\.\/lib\/config\/contact'/,
  );
  // The published address is decided in one module. A literal here is drift waiting to happen.
  assert.doesNotMatch(sectionsSource, /me@geralddagher\.com/);
});

test('the license is named, and the deed is linked', () => {
  assert.match(flat, /Creative Commons Attribution 4\.0 International \(CC BY 4\.0\)/);
  // Substring, not an unanchored URL regex (the link sits inside markup, so it cannot be anchored).
  assert.ok(flat.includes('https://creativecommons.org/licenses/by/4.0/'));
  assert.match(flat, /rel="license noopener noreferrer"/);
  assert.match(flat, /name BlackStory and link back to the page you took it from/);
});

test('the license section states the facts/expression line and carves out third parties', () => {
  // Feist in plain English: the license reaches the writing and the selection, never the facts.
  assert.match(flat, /The facts in a record belong to nobody\./);
  assert.match(flat, /no license at all and no credit owed/);
  assert.match(flat, /the prose, the arrangement, and the judgment about what to include/);

  // The carve-out, with the sources actually displayed on records named.
  assert.match(flat, /does not reach material that is not BlackStory&apos;s to license/);
  for (const source of [
    'Wikimedia Commons',
    'Open Library',
    'the Internet Archive',
    'USGS National Map imagery',
    'OpenStreetMap by way of OpenMapTiles',
  ]) {
    assert.ok(flat.includes(source), `third-party source "${source}" is not named`);
  }
  // Cited-only sources are not displayed images and must not be listed as if they were.
  assert.doesNotMatch(flat, /Library of Congress|National Register of Historic Places|NRHP/);
});

test('the copyright window is the modeled one, and no agent is implied', () => {
  assert.match(sectionsSource, /ACKNOWLEDGEMENT_HOURS = 72/);
  assert.match(sectionsSource, /RESOLUTION_DAYS = 30/);
  assert.match(flat, /I acknowledge a copyright complaint within \{ACKNOWLEDGEMENT_HOURS\} hours/);
  assert.match(flat, /reach a decision within \{RESOLUTION_DAYS\} days/);
  assert.match(flat, /Material found to be infringing is removed\./);
  // No agent is registered, so nothing on the page may read as if one were.
  assert.doesNotMatch(sectionsSource, /DMCA|designated agent|Copyright Office/i);
  // No mailing address, for the same reason.
  assert.doesNotMatch(sectionsSource, /P\.?O\.? Box|Suite \d|\b\d{5}(?:-\d{4})?\b/);
});

test('the submissions section quotes the corrections notice rather than restating it', () => {
  assert.match(
    sectionsSource,
    /import \{ CORRECTION_PRIVACY_NOTICE \} from '\.\.\/corrections\/copy'/,
  );
  assert.match(sectionsSource, /\{CORRECTION_PRIVACY_NOTICE\.body\}/);
  assert.match(flat, /nothing you send is visible to other readers/);
  assert.match(sectionsSource, /href="\/corrections"/);
  assert.match(sectionsSource, /href="\/submit"/);
});

test('the record-about-you section stands on its own, not buried under a dispute heading', () => {
  assert.match(sectionsSource, /id="about-you"/);
  assert.match(flat, /If a record about you is wrong/);
  assert.doesNotMatch(sectionsSource, /Content disputes/i);
  // It sits ahead of the copyright section, where a person looking for it reaches it first.
  assert.ok(sectionsSource.indexOf('id="about-you"') < sectionsSource.indexOf('id="copyright"'));
});

test('the accuracy section does not pretend the disclaimer cures a wrong record', () => {
  assert.match(flat, /provided as it stands, without warranty of completeness or currency/);
  assert.match(flat, /describes the archive; it does not excuse it/);
  assert.match(flat, /does not relieve me of the work of putting it right/);
});

test('the liability limit carries the qualifier that keeps it enforceable', () => {
  // California Civil Code section 1668 voids the unqualified version.
  assert.match(flat, /To the extent the law allows, I am not liable/);
  assert.match(flat, /indirect or consequential loss/);
});

test('the affiliate relationship is disclosed and bounded', () => {
  assert.match(flat, /Bookshop\.org through an affiliate program/);
  assert.match(flat, /pays BlackStory a commission/);
  assert.match(flat, /never decides which books appear or what a record says about them/);
});

test('changes are posted with a date, not reserved as a unilateral right', () => {
  assert.match(flat, /A material change to this notice is posted here, with a new date at the top/);
  assert.match(flat, /Last updated: [A-Z][a-z]+ \d{4}/);
  // Douglas v. U.S. District Court, 495 F.3d 1062: a posted-only unilateral change is no change.
  assert.doesNotMatch(sectionsSource, /at any time without notice|without prior notice/i);
});

test('nothing on the page is a clause that needs a reader to have agreed', () => {
  const forbidden: readonly (readonly [RegExp, string])[] = [
    [/\barbitrat/i, 'binding arbitration'],
    [/class[- ]action waiver|waive .{0,20}class/i, 'a class-action waiver'],
    [/\bindemnif/i, 'reader indemnification'],
    [/governing law|choice of law|exclusive jurisdiction|venue shall|forum selection/i, 'venue'],
    [/\bEULA\b|end user license agreement/i, 'a custom app EULA'],
    [/terminate your account|suspend your account|create an account/i, 'account lifecycle'],
    [/subscription|auto-renew|refund|billing/i, 'billing'],
    [/by using this site.{0,40}you agree|you agree to be bound/i, 'an assent gate'],
  ];
  for (const [pattern, what] of forbidden) {
    assert.doesNotMatch(proseFlat, pattern, `${what} does not belong on a notice`);
  }
});

test('there is no institutional we: the site speaks, or Gerald Dagher does', () => {
  for (const line of proseLines) {
    assert.doesNotMatch(line, /\b(?:[Ww]e|[Oo]ur|[Uu]s)\b/, `institutional voice: ${line.trim()}`);
  }
  // The first person singular is the other half of the convention, and it must actually appear.
  assert.match(flat, /\bI acknowledge a copyright complaint\b/);
});

test('/terms is a Utility surface and is now advertised in the sitemap', () => {
  assert.equal(surfaceClassFor('/terms'), 'utility');

  const terms = allDestinations().find((destination) => destination.path === '/terms');
  assert.ok(terms, '/terms is missing from the destination registry');
  assert.deepEqual(terms?.crawl, { changeFrequency: 'monthly', priority: 0.3 });
  assert.notEqual(terms?.noIndex, true);
  assert.ok(
    crawlableDestinations().some((destination) => destination.path === '/terms'),
    '/terms has a page now and belongs in the sitemap',
  );
});
