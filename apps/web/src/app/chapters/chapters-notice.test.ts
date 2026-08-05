/**
 * `/chapters` notice copy (SP-atlas-v9 chapters package).
 *
 * The unavailable (load failure) state and the none-published state must read differently: one
 * is a fault on our side, the other is an honest statement that the release has nothing here
 * yet. Collapsing them would tell a reader whose connection to the live record failed that the
 * archive is simply empty. This asserts the copy actually differs, rather than trusting that the
 * two `if` branches in the page never drift back together.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chaptersNotice,
  computeChaptersFacts,
  paginateChapters,
  parseChaptersQuery,
  buildEraGroups,
  buildPlaceGroups,
  chaptersHref,
} from './chapters-index';
import type { PublicArticleListItemDoc } from '@repo/schemas';

function item(overrides: Partial<PublicArticleListItemDoc>): PublicArticleListItemDoc {
  return {
    id: overrides.id ?? 'a1',
    releaseId: 'rel-1',
    slug: overrides.slug ?? 'a-chapter',
    title: overrides.title ?? 'A chapter',
    summary: overrides.summary ?? 'A summary long enough to pass validation.',
    publishedAt: overrides.publishedAt ?? '2020-01-01',
    eraLabel: overrides.eraLabel ?? 'Redlining',
    placeLabel: overrides.placeLabel ?? 'Tulsa, Oklahoma',
    ...overrides,
  };
}

describe('/chapters · the two notice states differ', () => {
  it('unavailable and none-published render different titles and bodies', () => {
    const unavailable = chaptersNotice('unavailable', 0, 0);
    const nonePublished = chaptersNotice('live', 0, 0);

    assert.notEqual(unavailable.title, nonePublished.title);
    assert.notEqual(unavailable.body, nonePublished.body);
  });

  it('unavailable blames our side, not the archive', () => {
    const notice = chaptersNotice('unavailable', 0, 0);
    assert.match(notice.body, /reconnect to the live record/);
  });

  it('none-published states the release is genuinely empty', () => {
    const notice = chaptersNotice('live', 0, 0);
    assert.match(notice.body, /No chapters are published yet/);
  });

  it('a live source with results but a narrowing that matches nothing is a third, distinct message', () => {
    const filteredEmpty = chaptersNotice('live', 12, 0);
    const unavailable = chaptersNotice('unavailable', 0, 0);
    const nonePublished = chaptersNotice('live', 0, 0);
    assert.notEqual(filteredEmpty.body, unavailable.body);
    assert.notEqual(filteredEmpty.body, nonePublished.body);
  });
});

describe('/chapters · header facts come from the release, never hardcoded', () => {
  it('published count, era span and place count derive from the listed items', () => {
    const items = [
      item({ id: 'a', publishedAt: '1917-01-01', placeLabel: 'Tulsa, Oklahoma' }),
      item({ id: 'b', publishedAt: '1965-06-01', placeLabel: 'Selma, Alabama' }),
      item({ id: 'c', publishedAt: '2005-06-01', placeLabel: 'Tulsa, Oklahoma' }),
    ];
    const facts = computeChaptersFacts(items);
    assert.equal(facts.publishedCount, 3);
    assert.equal(facts.eraSpanLabel, '1917 to 2005');
    assert.equal(facts.placeCount, 2);
  });

  it('an empty release has no era span rather than a fabricated one', () => {
    const facts = computeChaptersFacts([]);
    assert.equal(facts.publishedCount, 0);
    assert.equal(facts.eraSpanLabel, undefined);
    assert.equal(facts.placeCount, 0);
  });
});

describe('/chapters · rail groups stay inside the index', () => {
  const items = [
    item({ id: 'a', eraLabel: 'Redlining', placeLabel: 'Tulsa, Oklahoma' }),
    item({ id: 'b', eraLabel: 'Redlining', placeLabel: 'Selma, Alabama' }),
    item({ id: 'c', eraLabel: 'Voting rights', placeLabel: 'Selma, Alabama' }),
  ];

  it('every era and place entry links back to /chapters, never the Atlas or /records', () => {
    for (const entry of [...buildEraGroups(items), ...buildPlaceGroups(items)]) {
      assert.match(entry.href, /^\/chapters(\?|$)/);
    }
  });

  it('counts match how many chapters carry that era or place', () => {
    const eraGroups = buildEraGroups(items);
    const redlining = eraGroups.find((entry) => entry.label === 'Redlining');
    assert.equal(redlining?.count, 2);
  });
});

describe('/chapters · windowing reuses the records page-size mechanism', () => {
  it('holds at fifty chapters without needing a second page', () => {
    const fifty = Array.from({ length: 50 }, (_, index) =>
      item({ id: `c${index}`, slug: `c-${index}` }),
    );
    const result = paginateChapters(fifty, parseChaptersQuery({}));
    assert.equal(result.rows.length, 50);
    assert.equal(result.pageCount, 1);
    assert.equal(result.previousHref, undefined);
    assert.equal(result.nextHref, undefined);
  });

  it('paginates past the page size with real prev/next anchors', () => {
    const many = Array.from({ length: 250 }, (_, index) =>
      item({ id: `c${index}`, slug: `c-${index}` }),
    );
    const page1 = paginateChapters(many, parseChaptersQuery({}));
    assert.ok(page1.rows.length > 0 && page1.rows.length < many.length);
    assert.equal(page1.previousHref, undefined);
    assert.notEqual(page1.nextHref, undefined);

    const page2 = paginateChapters(many, parseChaptersQuery({ page: '2' }));
    assert.notEqual(page2.previousHref, undefined);
  });

  it('page=1 is never emitted in an href, matching the records convention', () => {
    assert.equal(chaptersHref({ page: 1 }), '/chapters');
    assert.equal(chaptersHref({ page: 2 }), '/chapters?page=2');
  });
});
