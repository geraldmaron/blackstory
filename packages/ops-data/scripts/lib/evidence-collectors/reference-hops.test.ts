/**
 * Unit tests for reference-hop traversal policy (repo-n7p6.17). All pure — no network.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentKey,
  extractReferenceLinks,
  planReferenceHops,
  relevanceScore,
  subjectTokens,
  type HopCandidate,
} from './reference-hops.ts';

const SUBJECT = {
  displayName: 'Tri-State Bank',
  city: 'Memphis',
  county: 'Shelby',
  state: 'Tennessee',
};

const candidate = (
  url: string,
  anchorText = 'Tri-State Bank of Memphis',
  context = '',
): HopCandidate => ({
  url,
  anchorText,
  context,
});

test('subjectTokens keeps identifying words and drops generic local-history filler', () => {
  const tokens = subjectTokens({ displayName: 'Dunbar High School', city: 'Washington' });
  assert.ok(tokens.includes('dunbar'));
  assert.ok(tokens.includes('washington'));
  assert.ok(!tokens.includes('school'), 'generic descriptor would match nearly any page');
  assert.ok(!tokens.includes('high'), 'generic descriptor, same as school');
});

test('relevanceScore counts distinct subject tokens found in anchor or context', () => {
  // 'tri' is below the token-length floor, so "Tri-State Bank" contributes 'state' and 'bank'.
  const tokens = subjectTokens(SUBJECT);
  assert.equal(relevanceScore(candidate('https://x.gov/a', 'Tri-State Bank'), tokens), 2);
  assert.equal(
    relevanceScore(candidate('https://x.gov/a', '[12]', 'the Tri-State Bank in Memphis'), tokens),
    3,
    'a bare anchor still scores when the surrounding sentence names the subject',
  );
});

test('documentKey collapses www and trailing slash but keeps distinct paths apart', () => {
  assert.equal(documentKey('https://WWW.Nps.gov/a/b/'), documentKey('https://nps.gov/a/b'));
  assert.notEqual(documentKey('https://nps.gov/a'), documentKey('https://nps.gov/b'));
  assert.equal(documentKey('javascript:alert(1)'), null);
  assert.equal(documentKey('not a url'), null);
});

test('extractReferenceLinks resolves relative hrefs and dedupes repeated links', () => {
  const html = `
    <p>See <a href="/history/tri-state">the Tri-State Bank record</a> and
    <a href="https://nps.gov/history/tri-state">the same page again</a>.</p>
    <a href="#cite1">skip in-page anchor</a>
  `;
  const links = extractReferenceLinks(html, 'https://nps.gov/index.html');
  assert.equal(links.length, 1, 'the two links are the same document; the anchor is skipped');
  assert.equal(links[0]!.url, 'https://nps.gov/history/tri-state');
  assert.match(links[0]!.anchorText, /Tri-State Bank record/u);
});

test('planReferenceHops follows in-policy relevant links and ranks tier1 first', () => {
  const plan = planReferenceHops({
    candidates: [
      candidate('https://hmdb.org/m.asp?m=123'),
      candidate('https://loc.gov/item/tri-state-memphis'),
    ],
    subject: SUBJECT,
    visited: new Set(),
    remainingFetches: 10,
  });
  assert.deepEqual(
    plan.follow.map((hop) => hop.tier),
    ['tier1', 'tier2'],
  );
  assert.equal(plan.leads.length, 0);
});

test('planReferenceHops records an off-policy host as a lead rather than fetching it', () => {
  const plan = planReferenceHops({
    candidates: [candidate('https://someones-blog.example/tri-state-bank-memphis')],
    subject: SUBJECT,
    visited: new Set(),
    remainingFetches: 10,
  });
  assert.equal(plan.follow.length, 0);
  assert.equal(plan.leads.length, 1);
  assert.equal(plan.rejected[0]?.reason, 'off_policy');
});

test('planReferenceHops never hops to Wikipedia or Wikidata', () => {
  // Bridge sources by policy, and the sweep already has a dedicated Wikipedia collector.
  const plan = planReferenceHops({
    candidates: [
      candidate('https://en.wikipedia.org/wiki/Tri-State_Bank'),
      candidate('https://www.wikidata.org/wiki/Q123'),
    ],
    subject: SUBJECT,
    visited: new Set(),
    remainingFetches: 10,
  });
  assert.equal(plan.follow.length, 0);
  assert.equal(plan.leads.length, 0);
  assert.deepEqual(
    plan.rejected.map((r) => r.reason),
    ['bridge_source', 'bridge_source'],
  );
});

test('planReferenceHops drops links that say nothing about the subject', () => {
  // Without this the walk leaves the entity within one hop and "research" cites pages that
  // never mention it.
  const plan = planReferenceHops({
    candidates: [candidate('https://nps.gov/privacy', 'Privacy policy', 'Site navigation footer')],
    subject: SUBJECT,
    visited: new Set(),
    remainingFetches: 10,
  });
  assert.equal(plan.follow.length, 0);
  assert.equal(plan.rejected[0]?.reason, 'not_relevant');
});

test('planReferenceHops skips documents already visited in this walk', () => {
  const url = 'https://loc.gov/item/tri-state-memphis';
  const plan = planReferenceHops({
    candidates: [candidate(url)],
    subject: SUBJECT,
    visited: new Set([documentKey(url)!]),
    remainingFetches: 10,
  });
  assert.equal(plan.follow.length, 0);
  assert.equal(plan.rejected[0]?.reason, 'already_visited');
});

test('planReferenceHops prefers a publisher not already in the captured evidence', () => {
  const plan = planReferenceHops({
    candidates: [
      candidate('https://nps.gov/tri-state-memphis'),
      candidate('https://loc.gov/item/tri-state-memphis'),
    ],
    subject: SUBJECT,
    visited: new Set(),
    capturedHosts: new Set(['nps.gov']),
    remainingFetches: 10,
  });
  // Both are tier1; the one from an agency not already quoted corroborates more, so it leads.
  assert.equal(plan.follow[0]?.candidate.url, 'https://loc.gov/item/tri-state-memphis');
  assert.equal(plan.follow[0]?.newLineage, true);
  assert.equal(plan.follow[1]?.newLineage, false);
});

test('planReferenceHops truncates to the remaining shared budget', () => {
  const plan = planReferenceHops({
    candidates: [
      candidate('https://loc.gov/a/tri-state-memphis'),
      candidate('https://loc.gov/b/tri-state-memphis'),
      candidate('https://loc.gov/c/tri-state-memphis'),
    ],
    subject: SUBJECT,
    visited: new Set(),
    remainingFetches: 2,
  });
  assert.equal(plan.follow.length, 2);
});

test('planReferenceHops follows nothing once the budget is spent', () => {
  const plan = planReferenceHops({
    candidates: [candidate('https://loc.gov/item/tri-state-memphis')],
    subject: SUBJECT,
    visited: new Set(),
    remainingFetches: 0,
  });
  assert.equal(plan.follow.length, 0);
});
