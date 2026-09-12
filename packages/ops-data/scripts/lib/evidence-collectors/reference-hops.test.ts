/**
 * Unit tests for reference-hop traversal policy (repo-n7p6.17). All pure — no network.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentKey,
  extractReferenceLinks,
  isDocumentLikeUrl,
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

test('relevanceScore counts a match found only in the link target path, not the anchor or context', () => {
  // A bare anchor on an unhelpful page (a footer "read more") still identifies the subject when
  // the destination's own slug names it — the target's path/title is a signal in its own right,
  // not only a tiebreaker on top of the anchor.
  const tokens = subjectTokens(SUBJECT);
  const bareAnchor = candidate('https://loc.gov/item/tri-state-bank-memphis', 'read more', '');
  assert.equal(
    relevanceScore(bareAnchor, tokens),
    3,
    'state, bank, and memphis all live in the URL slug',
  );
});

test('planReferenceHops rejects a single place-token match under the new relevance floor', () => {
  // The failure this threshold targets: a link whose only match is the subject's own place name
  // recurring in a government site's boilerplate ("Ash Grove" in a city welcome page), not
  // anything that names the subject itself. One token used to be enough to spend a fetch.
  const plan = planReferenceHops({
    candidates: [
      candidate(
        'https://ashgrove.example.gov/welcome',
        'Welcome to Ash Grove',
        'City services for Ash Grove residents',
      ),
    ],
    subject: { displayName: 'Berry Cemetery', city: 'Ash Grove', state: 'Missouri' },
    visited: new Set(),
    remainingFetches: 10,
  });
  assert.equal(plan.follow.length, 0);
  assert.equal(plan.rejected[0]?.reason, 'not_relevant');
});

test('isDocumentLikeUrl keeps PDFs, item/article/record pages, and marker detail pages', () => {
  assert.ok(isDocumentLikeUrl('https://mht.maryland.gov/documents/nr-pdfs/berry-cemetery.pdf'));
  assert.ok(isDocumentLikeUrl('https://loc.gov/item/tri-state-bank-memphis/'));
  assert.ok(isDocumentLikeUrl('https://nps.gov/articles/berry-cemetery-history.htm'));
  assert.ok(
    isDocumentLikeUrl('https://hmdb.org/m.asp?m=123'),
    'hmdb marker detail pages use m.asp',
  );
});

test('isDocumentLikeUrl drops navigation, index, search, login, share, and pagination links', () => {
  assert.equal(isDocumentLikeUrl('https://covingtonky.gov/police-department/staff'), false);
  assert.equal(isDocumentLikeUrl('https://ashgrove.example.gov/welcome'), false);
  assert.equal(
    isDocumentLikeUrl('https://ashgrove.example.gov/'),
    false,
    'bare root is a home page',
  );
  assert.equal(isDocumentLikeUrl('https://hmdb.org/results.asp?county=Shelby'), false);
  assert.equal(isDocumentLikeUrl('https://example.gov/login'), false);
  assert.equal(
    isDocumentLikeUrl('https://example.gov/articles?page=2'),
    false,
    'a bare listing index has no slug after it, and the query is pagination',
  );
  assert.equal(
    isDocumentLikeUrl('https://example.gov/find?s=berry-cemetery'),
    false,
    'an in-site search query',
  );
  assert.ok(
    isDocumentLikeUrl('https://example.gov/articles/berry-cemetery?utm_source=newsletter'),
    'a tracking parameter on a real article slug does not make the destination a nav page',
  );
});

test('planReferenceHops rejects a relevant-scoring navigation link and keeps a relevant document link', () => {
  // The HTML a real walk would see: a staff-directory nav link that happens to name the subject
  // in its anchor (so it clears the relevance floor on its own), next to an NRHP nomination PDF.
  // Only the document-shape gate tells them apart.
  const html = `
    <header>City of Ash Grove — services for Berry Cemetery visitors</header>
    <a href="/staff">Staff directory for Berry Cemetery Historic District</a>
    <a href="https://mht.maryland.gov/documents/nr-pdfs/berry-cemetery-nomination.pdf">
      Berry Cemetery National Register nomination
    </a>
  `;
  const candidates = extractReferenceLinks(html, 'https://ashgrove.example.gov/parks');
  const plan = planReferenceHops({
    candidates,
    subject: { displayName: 'Berry Cemetery', city: 'Ash Grove', state: 'Missouri' },
    visited: new Set(),
    remainingFetches: 10,
  });

  const navRejection = plan.rejected.find((r) => r.candidate.url.includes('/staff'));
  assert.equal(
    navRejection?.reason,
    'navigational',
    'a staff directory is site navigation, not a source about the cemetery, even though it names it',
  );

  const kept = plan.follow.find((hop) => hop.candidate.url.includes('nr-pdfs'));
  assert.ok(kept, 'the NRHP nomination PDF is a document about the subject and should be followed');
});
