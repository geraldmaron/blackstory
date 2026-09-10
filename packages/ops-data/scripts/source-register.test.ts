/**
 * The acceptance rule, exercised against fixture Wikidata responses. Nothing here touches the
 * network: `proposeHosts` takes its fetcher, and every other function is pure.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildClassClosureQuery,
  buildItemFactsQuery,
  buildOfficialWebsiteProbeQuery,
  candidateWebsiteIris,
  collectCandidates,
  isGovernmentTldHost,
  mergeEntries,
  orgTypeForClasses,
  proposeHosts,
  selectApplicableProposals,
  sparqlBindings,
  verdictForHost,
  websiteAuthorizesHost,
  type ProposalFile,
  type WikidataCandidate,
} from './source-register.ts';
import type { SourceRegisterEntry } from './lib/source-register.ts';

/** Closure fixture: what `?cls wdt:P279* ?root` returns for the classes used below. */
const CLOSURE = new Map<string, readonly string[]>([
  ['Q28564', ['Q7075']], // public library -> library
  ['Q5774403', ['Q5774403']], // historical society -> itself
  ['Q35127', []], // website -> nothing on the allowlist
  ['Q163740', []], // nonprofit organization -> deliberately not on the allowlist
  ['Q1093829', ['Q327333']], // city in Texas -> government agency
  ['Q11032', ['Q11032']], // newspaper -> itself
  ['Q27031009', ['Q166118', 'Q3152824']], // public archive -> archives, cultural institution
]);

function candidate(overrides: Partial<WikidataCandidate> & { qid: string }): WikidataCandidate {
  return {
    label: 'Test Item',
    officialWebsites: [],
    instanceOf: [],
    authorityIds: {},
    ...overrides,
  };
}

const LIBRARY = candidate({
  qid: 'Q219555',
  label: 'New York Public Library',
  officialWebsites: ['https://www.nypl.org'],
  instanceOf: ['Q28564', 'Q163740'],
  authorityIds: { lcnaf: 'n79033065', viaf: '143013888' },
});

test('accept needs an official website, an authority id and an allowlisted class', () => {
  const proposal = verdictForHost('nypl.org', [LIBRARY], CLOSURE);
  assert.equal(proposal.verdict, 'accept');
  assert.equal(proposal.entry?.orgType, 'library');
  assert.equal(proposal.entry?.sourceClass, 'reputable_secondary');
  assert.equal(proposal.entry?.basis.wikidata, 'Q219555');
  assert.equal(proposal.entry?.basis.officialWebsite, 'https://www.nypl.org');
});

test('an item with no authority identifier is review, not accept', () => {
  // The measured case: state encyclopedias are real, edited publications that no national
  // library has cataloged under their own name. They stay on the curated list until someone
  // decides otherwise, and the tool says exactly why.
  const proposal = verdictForHost(
    'encyclopediaofalabama.org',
    [
      candidate({
        qid: 'Q5375680',
        label: 'Encyclopedia of Alabama',
        officialWebsites: ['http://www.encyclopediaofalabama.org/'],
        instanceOf: ['Q615699'],
      }),
    ],
    new Map([['Q615699', ['Q615699']]]),
  );
  assert.equal(proposal.verdict, 'review');
  assert.match(proposal.reasons[0] ?? '', /no authority identifier/u);
  assert.equal(proposal.entry, undefined);
});

test('an item that is not an institution is review, whatever else it carries', () => {
  const proposal = verdictForHost(
    'poets.org',
    [
      candidate({
        qid: 'Q24635963',
        label: 'poets.org',
        officialWebsites: ['https://www.poets.org'],
        instanceOf: ['Q35127'],
        authorityIds: { viaf: '1' },
      }),
    ],
    CLOSURE,
  );
  assert.equal(proposal.verdict, 'review');
  assert.match(proposal.reasons[0] ?? '', /does not reach an allowlisted institution class/u);
});

test('nothing in Wikidata claiming the host is a reject', () => {
  assert.equal(verdictForHost('kcblackhistory.org', [], CLOSURE).verdict, 'reject');
});

test('a deep link is not a claim on the whole domain', () => {
  // The real bad accept from the first migration run: the Texas town of Anton has an LCNAF
  // record, is a city (which closes to government agency), and carries a P856 pointing at its
  // Handbook of Texas article. Without the site-root rule the tool proposed registering the
  // publisher's entire domain as a GOVERNMENT RECORD on a town's authority.
  const anton = candidate({
    qid: 'Q975193',
    label: 'Anton',
    officialWebsites: ['http://www.tshaonline.org/handbook/online/articles/hja10'],
    instanceOf: ['Q1093829'],
    authorityIds: { lcnaf: 'n1', viaf: '2' },
  });
  const proposal = verdictForHost('tshaonline.org', [anton], CLOSURE);
  assert.equal(proposal.verdict, 'reject');
  assert.match(proposal.reasons[0] ?? '', /is the root of/u);
});

test('websiteAuthorizesHost takes the root, the www form, and nothing else', () => {
  assert.equal(websiteAuthorizesHost('https://mnhs.org/', 'mnhs.org'), true);
  assert.equal(websiteAuthorizesHost('http://www.mnhs.org', 'mnhs.org'), true);
  assert.equal(websiteAuthorizesHost('https://mnhs.org/about', 'mnhs.org'), false);
  // A subdomain's homepage is that subdomain's claim, not the parent domain's.
  assert.equal(websiteAuthorizesHost('https://collections.mnhs.org/', 'mnhs.org'), false);
  assert.equal(websiteAuthorizesHost('https://mnhs.org.evil.example/', 'mnhs.org'), false);
  assert.equal(websiteAuthorizesHost('not a url', 'mnhs.org'), false);
});

test('a government TLD host is rejected rather than registered', () => {
  const proposal = verdictForHost(
    'msa.maryland.gov',
    [
      candidate({
        qid: 'Q17109505',
        label: 'Maryland State Archives',
        officialWebsites: ['https://msa.maryland.gov/'],
        instanceOf: ['Q27031009'],
        authorityIds: { lcnaf: 'n1' },
      }),
    ],
    CLOSURE,
  );
  // An entry could only lower it: an archive is reputable_secondary, and the `.gov` TLD already
  // reads government_record before the register is consulted.
  assert.equal(proposal.verdict, 'reject');
  assert.match(proposal.reasons[0] ?? '', /already classifies as government_record/u);
  assert.equal(isGovernmentTldHost('history.house.gov'), true);
  assert.equal(isGovernmentTldHost('army.mil'), true);
  assert.equal(isGovernmentTldHost('poets.org'), false);
});

test('two qualifying items that disagree about what a host is go to review', () => {
  const museum = candidate({
    qid: 'Q100',
    label: 'A Museum',
    officialWebsites: ['https://shared.example/'],
    instanceOf: ['Q28564'],
    authorityIds: { viaf: '1' },
  });
  const paper = candidate({
    qid: 'Q101',
    label: 'A Newspaper',
    officialWebsites: ['https://shared.example/'],
    instanceOf: ['Q11032'],
    authorityIds: { viaf: '2' },
  });
  const proposal = verdictForHost('shared.example', [museum, paper], CLOSURE);
  assert.equal(proposal.verdict, 'review');
  assert.match(proposal.reasons[0] ?? '', /disagree about what it is/u);
});

test('a registered newspaper grades as reportage, which is lower, not higher', () => {
  const proposal = verdictForHost(
    'example-tribune.example',
    [
      candidate({
        qid: 'Q200',
        label: 'The Example Tribune',
        officialWebsites: ['https://example-tribune.example/'],
        instanceOf: ['Q11032'],
        authorityIds: { lcnaf: 'n1' },
      }),
    ],
    CLOSURE,
  );
  assert.equal(proposal.verdict, 'accept');
  assert.equal(proposal.entry?.sourceClass, 'news_reportage');
});

test('orgTypeForClasses picks the most specific type when several apply', () => {
  // Public archive closes to both archives and cultural institution. Archive is the more
  // specific statement about what the site is.
  assert.equal(orgTypeForClasses(['Q27031009'], CLOSURE), 'archive');
  assert.equal(orgTypeForClasses(['Q163740'], CLOSURE), undefined);
  assert.equal(orgTypeForClasses([], CLOSURE), undefined);
});

test('apply writes accepts and refuses everything else', () => {
  const file: ProposalFile = {
    checkedAt: '2026-09-10T00:00:00.000Z',
    proposals: [
      verdictForHost('nypl.org', [LIBRARY], CLOSURE),
      verdictForHost('kcblackhistory.org', [], CLOSURE),
      verdictForHost(
        'poets.org',
        [
          candidate({
            qid: 'Q24635963',
            officialWebsites: ['https://www.poets.org'],
            instanceOf: ['Q35127'],
            authorityIds: { viaf: '1' },
          }),
        ],
        CLOSURE,
      ),
    ],
  };
  const { entries, refused } = selectApplicableProposals(
    file,
    'A Reviewer',
    '2026-09-11T00:00:00.000Z',
  );
  assert.deepEqual(
    entries.map((row) => row.host),
    ['nypl.org'],
  );
  assert.equal(entries[0]?.reviewedBy, 'A Reviewer');
  assert.equal(entries[0]?.reviewedAt, '2026-09-11T00:00:00.000Z');
  // The basis was checked when the proposal was produced, not when a person signed off on it.
  assert.equal(entries[0]?.verifiedAt, '2026-09-10T00:00:00.000Z');
  assert.deepEqual(
    refused.map((row) => `${row.host}:${row.verdict}`),
    ['kcblackhistory.org:reject', 'poets.org:review'],
  );
});

test('mergeEntries replaces by host and keeps the file sorted', () => {
  const existing: SourceRegisterEntry[] = [
    {
      host: 'zzz.example',
      sourceClass: 'reputable_secondary',
      orgType: 'museum',
      label: 'Old',
      basis: {
        wikidata: 'Q1',
        officialWebsite: 'https://zzz.example/',
        authorityIds: {},
        instanceOf: [],
      },
      reviewedBy: 'x',
      reviewedAt: '2026-01-01T00:00:00.000Z',
      verifiedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const merged = mergeEntries(existing, [
    { ...existing[0]!, label: 'New' },
    { ...existing[0]!, host: 'aaa.example' },
  ]);
  assert.deepEqual(
    merged.map((row) => row.host),
    ['aaa.example', 'zzz.example'],
  );
  assert.equal(merged[1]?.label, 'New');
});

test('candidateWebsiteIris covers the eight spellings a homepage takes', () => {
  const iris = candidateWebsiteIris('mnhs.org');
  assert.equal(iris.length, 8);
  assert.ok(iris.includes('https://www.mnhs.org/'));
  assert.ok(iris.includes('http://mnhs.org'));
});

test('the probe query is a VALUES clause, never a pattern match', () => {
  // A regular expression over every official-website statement in Wikidata is a full index scan
  // and times out at the query service's 60-second ceiling. Measured 2026-09-10; the exact-IRI
  // probe answers the same question in under a second.
  const query = buildOfficialWebsiteProbeQuery(['mnhs.org']);
  assert.ok(query.includes('VALUES ?website'));
  assert.ok(!query.includes('REGEX'));
  assert.ok(!query.includes('CONTAINS'));
  assert.ok(buildItemFactsQuery(['Q1']).includes('wdt:P6006'));
  assert.ok(buildClassClosureQuery(['Q1']).includes('wdt:P279*'));
});

test('collectCandidates folds a row-per-value result into one record per item', () => {
  const bindings = sparqlBindings({
    results: {
      bindings: [
        {
          item: { value: 'http://www.wikidata.org/entity/Q1937351' },
          itemLabel: { value: 'Minnesota Historical Society' },
          website: { value: 'http://www.mnhs.org/' },
          p31: { value: 'http://www.wikidata.org/entity/Q5774403' },
          lcnaf: { value: 'n79007328' },
        },
        {
          item: { value: 'http://www.wikidata.org/entity/Q1937351' },
          itemLabel: { value: 'Minnesota Historical Society' },
          website: { value: 'http://www.mnhs.org/' },
          p31: { value: 'http://www.wikidata.org/entity/Q27031009' },
          imls: { value: '8402700300' },
        },
      ],
    },
  });
  const collected = collectCandidates(bindings);
  const item = collected.get('Q1937351');
  assert.equal(item?.label, 'Minnesota Historical Society');
  assert.deepEqual(item?.officialWebsites, ['http://www.mnhs.org/']);
  assert.deepEqual(item?.instanceOf, ['Q27031009', 'Q5774403']);
  assert.deepEqual(item?.authorityIds, { lcnaf: 'n79007328', imls: '8402700300' });
});

test('proposeHosts drives the whole path off a fixture fetcher, with no network', () => {
  const calls: string[] = [];
  const fetchJson = async (url: string): Promise<unknown> => {
    calls.push(url);
    if (url.includes('list=search')) return { query: { search: [] } };
    const query = decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
    if (query.includes('P279*')) {
      return {
        results: {
          bindings: [
            {
              cls: { value: 'http://www.wikidata.org/entity/Q28564' },
              root: { value: 'http://www.wikidata.org/entity/Q7075' },
            },
          ],
        },
      };
    }
    if (query.includes('VALUES ?website')) {
      return {
        results: {
          bindings: [
            {
              item: { value: 'http://www.wikidata.org/entity/Q219555' },
              website: { value: 'https://www.nypl.org/' },
            },
          ],
        },
      };
    }
    return {
      results: {
        bindings: [
          {
            item: { value: 'http://www.wikidata.org/entity/Q219555' },
            itemLabel: { value: 'New York Public Library' },
            website: { value: 'https://www.nypl.org/' },
            p31: { value: 'http://www.wikidata.org/entity/Q28564' },
            lcnaf: { value: 'n79033065' },
          },
        ],
      },
    };
  };
  return proposeHosts(['nypl.org'], { fetchJson, pace: async () => {} }).then((file) => {
    assert.equal(file.proposals.length, 1);
    assert.equal(file.proposals[0]?.verdict, 'accept');
    assert.equal(file.proposals[0]?.entry?.orgType, 'library');
    assert.ok(calls.every((url) => url.startsWith('https://')));
  });
});
