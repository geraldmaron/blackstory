import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BRIDGE_LINEAGE_KEY,
  authorityForHost,
  isPatentDocumentUrl,
  isSameLineage,
  resolveSourceLineage,
  sourceLineageKey,
} from './lineage.ts';

test('a patent and its mirror are one technical lineage', () => {
  // Case D of the evidence-semantics corpus. Latimer's patent read three ways.
  const uspto = sourceLineageKey({
    url: 'https://ppubs.uspto.gov/pubwebapp/rest/patents/html/252386?patentNumber=252386',
  });
  const google = sourceLineageKey({ url: 'https://patents.google.com/patent/US252386A/en' });
  const pdf = sourceLineageKey({
    url: 'https://patentimages.storage.googleapis.com/pdfs/US252386.pdf',
  });

  assert.equal(uspto, 'work:patent:us:252386');
  assert.equal(google, uspto);
  assert.equal(pdf, uspto);
});

test('patent number spellings that differ only in presentation are one work', () => {
  // Leading zeros, comma grouping and the kind code are how a number was written down,
  // not which document it is.
  const plain = sourceLineageKey({ url: 'https://patents.google.com/patent/US3118022' });
  const padded = sourceLineageKey({ url: 'https://patents.google.com/patent/US0003118022A/en' });
  const grouped = sourceLineageKey({ url: 'https://patents.google.com/patent/US3,118,022' });

  assert.equal(plain, 'work:patent:us:3118022');
  assert.equal(padded, plain);
  assert.equal(grouped, plain);
});

test('a design patent keeps its series letter, so D7 is not patent 7', () => {
  const design = sourceLineageKey({ url: 'https://patents.google.com/patent/USD7' });
  const utility = sourceLineageKey({ url: 'https://patents.google.com/patent/US7' });
  assert.equal(design, 'work:patent:us:D7');
  assert.equal(utility, 'work:patent:us:7');
  assert.notEqual(design, utility);
});

test('two patents are two lineages even on the same host', () => {
  // The authority fallback must never swallow documents that ARE separately identified.
  const traffic = sourceLineageKey({ url: 'https://patents.google.com/patent/US1475024A/en' });
  const hood = sourceLineageKey({ url: 'https://patents.google.com/patent/US1090936A/en' });
  assert.notEqual(traffic, hood);
});

test('subdomains of one authority are one lineage', () => {
  // nps.gov and www.nps.gov were two lineages under the hostname rule.
  const bare = sourceLineageKey({ url: 'https://nps.gov/articles/some-place.htm' });
  const www = sourceLineageKey({ url: 'https://www.nps.gov/articles/other-place.htm' });
  const gallery = sourceLineageKey({ url: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/1234' });

  assert.equal(bare, 'authority:national-park-service');
  assert.equal(www, bare);
  assert.equal(gallery, bare);
});

test('one authority publishing under two registrable domains is one lineage', () => {
  const si = sourceLineageKey({ url: 'https://americanhistory.si.edu/collections/object/1' });
  const mag = sourceLineageKey({ url: 'https://www.smithsonianmag.com/history/an-article/' });
  assert.equal(si, 'authority:smithsonian');
  assert.equal(mag, si);
});

test('a shared authority collapses two of its documents unless provenance splits them', () => {
  // Case C. The default is conservative: two reports by one agency are that agency's account,
  // not corroboration. Splitting requires a caller that checked.
  const first = { url: 'https://www.loc.gov/collections/one/about-this-collection/' };
  const second = { url: 'https://www.loc.gov/collections/two/about-this-collection/' };
  assert.ok(isSameLineage(first, second));

  const splitFirst = sourceLineageKey({ ...first, independentCreation: { documentId: 'coll-1' } });
  const splitSecond = sourceLineageKey({
    ...second,
    independentCreation: { documentId: 'coll-2' },
  });
  assert.notEqual(splitFirst, splitSecond);
  assert.equal(
    resolveSourceLineage({ ...first, independentCreation: { documentId: 'coll-1' } }).inferred,
    false,
  );
});

test('distinct Library of Congress items are distinct works without needing provenance', () => {
  // An item id names a document, so it does not need the independent-creation escape hatch.
  const a = sourceLineageKey({ url: 'https://www.loc.gov/item/mesn123/' });
  const b = sourceLineageKey({ url: 'https://www.loc.gov/item/mesn456/' });
  assert.equal(a, 'work:loc-item:mesn123');
  assert.notEqual(a, b);
});

test('every Wikipedia and Wikidata spelling is one bridge lineage', () => {
  // Case A's precondition. wikipedia_api and en.wikipedia.org graded oppositely before this.
  const spellings = [
    'https://en.wikipedia.org/wiki/Lewis_Latimer',
    'https://en.m.wikipedia.org/wiki/Lewis_Latimer',
    'https://fr.wikipedia.org/wiki/Lewis_Latimer',
    'https://www.wikidata.org/wiki/Q1868689',
  ];
  for (const url of spellings) {
    const lineage = resolveSourceLineage({ url });
    assert.equal(lineage.key, BRIDGE_LINEAGE_KEY);
    assert.equal(lineage.bridge, true);
  }
});

test('a bridge lineage is marked bridge and a government record is not', () => {
  assert.equal(resolveSourceLineage({ url: 'https://en.wikipedia.org/wiki/X' }).bridge, true);
  assert.equal(resolveSourceLineage({ url: 'https://www.nps.gov/x' }).bridge, false);
});

test('a lineage read from a work identifier is not inferred; one read from a host is', () => {
  // The `inferred` flag is what the host_based_lineage_suspect deficit reads.
  assert.equal(
    resolveSourceLineage({ url: 'https://patents.google.com/patent/US252386A/en' }).inferred,
    false,
  );
  assert.equal(resolveSourceLineage({ url: 'https://www.someagency.gov/report' }).inferred, true);
});

test('recorded upstream provenance beats anything readable from the URL', () => {
  // Case B: one wire story on three mastheads. Nothing in the three URLs says so, so the
  // pipeline has to record it — and when it does, the three collapse.
  const wire = { upstreamWorkId: 'ap-1963-08-28-march' };
  const hosts = [
    'https://www.examplepost.com/1963/08/28/march.html',
    'https://www.exampletribune.com/archive/march-1963',
    'https://news.example.org/civil-rights/march',
  ];
  const keys = hosts.map((url) => sourceLineageKey({ url, ...wire }));
  assert.equal(new Set(keys).size, 1);
  assert.equal(keys[0], 'work:ap-1963-08-28-march');
});

test('the same three mastheads without recorded provenance stay three lineages, and say they guessed', () => {
  // The honest failure mode: we cannot detect syndication from URLs alone, so we do not
  // pretend to. Each is flagged inferred so the deficit detector can see the guess.
  const hosts = [
    'https://www.examplepost.com/1963/08/28/march.html',
    'https://www.exampletribune.com/archive/march-1963',
    'https://news.example.org/civil-rights/march',
  ];
  const lineages = hosts.map((url) => resolveSourceLineage({ url }));
  assert.equal(new Set(lineages.map((l) => l.key)).size, 3);
  assert.ok(lineages.every((l) => l.inferred));
});

test('a source with no URL and no recorded work does not merge with another', () => {
  // Collapsing unidentifiable sources together would silently fuse unrelated evidence.
  const nothing = resolveSourceLineage({});
  assert.equal(nothing.key, 'unresolved:no-source');
  assert.equal(nothing.inferred, true);
});

test('an unparseable citation string keys on itself rather than on a shared bucket', () => {
  const a = sourceLineageKey({ url: 'National Archives, RG 241, box 4' });
  const b = sourceLineageKey({ url: 'Cleveland Gazette, 1923-11-24, p.1' });
  assert.notEqual(a, b);
});

test('a lookalike host is not a subdomain of the authority it imitates', () => {
  // hostMatches, not substring: evil-nps.gov.example.com must not attribute to the Park Service.
  assert.notEqual(authorityForHost('evil-nps.gov.example.com'), 'national-park-service');
  assert.equal(authorityForHost('npgallery.nps.gov'), 'national-park-service');
});

test('a search or collection URL falls through to the authority rather than inventing a work', () => {
  // /item/ names a document; a search names a place to look.
  const search = resolveSourceLineage({ url: 'https://www.loc.gov/search/?q=latimer' });
  assert.equal(search.kind, 'authority');
  assert.equal(search.key, 'authority:library-of-congress');
});

test('a DOI is one work wherever it is resolved from', () => {
  const doiOrg = sourceLineageKey({ url: 'https://doi.org/10.2307/2717721' });
  assert.equal(doiOrg, 'work:doi:10.2307/2717721');
});

test('a National Archives catalog record is a work, and two ids are two works', () => {
  const a = sourceLineageKey({ url: 'https://catalog.archives.gov/id/12345' });
  const b = sourceLineageKey({ url: 'https://catalog.archives.gov/id/67890' });
  assert.equal(a, 'work:nara:12345');
  assert.notEqual(a, b);
});

test('isPatentDocumentUrl finds a patent document on every mirror, and only a document', () => {
  assert.equal(isPatentDocumentUrl('https://patents.google.com/patent/US252386A/en'), true);
  assert.equal(
    isPatentDocumentUrl('https://patentimages.storage.googleapis.com/pdfs/US252386.pdf'),
    true,
  );
  assert.equal(
    isPatentDocumentUrl(
      'https://ppubs.uspto.gov/pubwebapp/rest/patents/html/252386?patentNumber=252386',
    ),
    true,
  );
  // freepatentsonline.com names the patent as the bare filename, with no /patent/ segment —
  // the case that needed its own extraction rule alongside the shared patentWorkFromUrl paths.
  assert.equal(isPatentDocumentUrl('https://www.freepatentsonline.com/4723129.html'), true);

  // A search page, a listing, and the mirror's own home page name no document.
  assert.equal(isPatentDocumentUrl('https://patents.google.com/?q=latimer'), false);
  assert.equal(isPatentDocumentUrl('https://patents.google.com/'), false);
  assert.equal(isPatentDocumentUrl('https://www.freepatentsonline.com/'), false);
  assert.equal(isPatentDocumentUrl('https://www.freepatentsonline.com/search.html?q=x'), false);

  // An unrelated URL, and an unparseable string, are both not a patent document.
  assert.equal(isPatentDocumentUrl('https://www.nps.gov/articles/some-place.htm'), false);
  assert.equal(isPatentDocumentUrl('not a url'), false);
});
