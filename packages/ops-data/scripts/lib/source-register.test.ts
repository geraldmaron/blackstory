/**
 * Register lookup, and the one thing a host allowlist must never get wrong: a look-alike domain
 * borrowing a registered host as a substring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entryFromAssessments,
  hostMatchesRegisterHost,
  isAgentAssessmentBasis,
  loadSourceRegister,
  lookupSourceRegister,
  lookupSourceRegisterByUrl,
  ORG_TYPE_SOURCE_CLASS,
  setSourceRegisterForTesting,
  SOURCE_REGISTER_ORG_TYPES,
  WIKIDATA_CLASS_ALLOWLIST,
  type SourceRegisterEntry,
  type SourceRegisterFile,
} from './source-register.ts';

function entry(overrides: Partial<SourceRegisterEntry> & { host: string }): SourceRegisterEntry {
  return {
    sourceClass: 'reputable_secondary',
    orgType: 'library',
    label: 'Test Institution',
    basis: {
      wikidata: 'Q1',
      officialWebsite: `https://${overrides.host}/`,
      authorityIds: { lcnaf: 'n00000000' },
      instanceOf: ['Q7075'],
    },
    reviewedBy: 'test',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    verifiedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function withRegister(file: SourceRegisterFile, body: () => void): void {
  setSourceRegisterForTesting(file);
  try {
    body();
  } finally {
    setSourceRegisterForTesting(undefined);
  }
}

test('a registered host matches itself and its subdomains', () => {
  withRegister({ version: 1, entries: [entry({ host: 'nypl.org' })] }, () => {
    assert.equal(lookupSourceRegister('nypl.org')?.host, 'nypl.org');
    assert.equal(lookupSourceRegister('digital.nypl.org')?.host, 'nypl.org');
    assert.equal(lookupSourceRegister('WWW.NYPL.ORG')?.host, 'nypl.org');
    // A trailing dot is the DNS root, not a different name.
    assert.equal(lookupSourceRegister('nypl.org.')?.host, 'nypl.org');
  });
});

test('a look-alike domain does not inherit a registered host', () => {
  // The whole point of comparing parsed hostnames instead of substrings
  // (CodeQL js/incomplete-url-substring-sanitization). Every one of these contains the
  // registered host as a substring and none of them is the New York Public Library.
  withRegister({ version: 1, entries: [entry({ host: 'nypl.org' })] }, () => {
    assert.equal(lookupSourceRegister('nypl.org.evil.example'), undefined);
    assert.equal(lookupSourceRegister('notnypl.org'), undefined);
    assert.equal(lookupSourceRegister('nypl.org.co'), undefined);
    assert.equal(lookupSourceRegisterByUrl('https://nypl.org.evil.example/schomburg'), undefined);
  });
});

test('hostMatchesRegisterHost is host-or-subdomain, never substring', () => {
  assert.equal(hostMatchesRegisterHost('mnhs.org', 'mnhs.org'), true);
  assert.equal(hostMatchesRegisterHost('collections.mnhs.org', 'mnhs.org'), true);
  assert.equal(hostMatchesRegisterHost('mnhs.org.attacker.example', 'mnhs.org'), false);
  assert.equal(hostMatchesRegisterHost('evil-mnhs.org', 'mnhs.org'), false);
});

test('the most specific registered host wins when two could match', () => {
  withRegister(
    {
      version: 1,
      entries: [
        entry({ host: 'example.org', orgType: 'library' }),
        entry({
          host: 'press.example.org',
          orgType: 'news_publisher',
          sourceClass: 'news_reportage',
        }),
      ],
    },
    () => {
      assert.equal(lookupSourceRegister('press.example.org')?.orgType, 'news_publisher');
      assert.equal(lookupSourceRegister('other.example.org')?.orgType, 'library');
    },
  );
});

test('lookupSourceRegisterByUrl ignores anything that is not a URL', () => {
  withRegister({ version: 1, entries: [entry({ host: 'nypl.org' })] }, () => {
    assert.equal(lookupSourceRegisterByUrl('not a url'), undefined);
    assert.equal(lookupSourceRegisterByUrl(''), undefined);
    assert.equal(lookupSourceRegisterByUrl(undefined), undefined);
    assert.equal(
      lookupSourceRegisterByUrl('https://www.nypl.org/research/schomburg')?.host,
      'nypl.org',
    );
  });
});

test('every organization type is reachable from the Wikidata class allowlist', () => {
  // A type nothing can produce would be a promise the tool cannot keep: `apply` only ever
  // writes entries the verdict logic accepted, and the verdict logic only ever names a type
  // that some allowlisted class yields.
  const producible = new Set(Object.values(WIKIDATA_CLASS_ALLOWLIST));
  for (const orgType of SOURCE_REGISTER_ORG_TYPES) {
    assert.ok(producible.has(orgType), `${orgType} is not produced by any allowlisted class`);
  }
});

test('only a government agency carries government authority', () => {
  const governmentTypes = SOURCE_REGISTER_ORG_TYPES.filter(
    (orgType) => ORG_TYPE_SOURCE_CLASS[orgType] === 'government_record',
  );
  assert.deepEqual(governmentTypes, ['government_agency']);
});

test('the committed register file parses and holds no government_record entry', () => {
  // Every entry in the shipped file has to satisfy the rule the module header states: a
  // Wikidata item, an official website, at least one authority identifier, and no government
  // authority granted off a government TLD (which the register refuses to hold at all).
  const file = loadSourceRegister();
  assert.ok(file.entries.length > 0);
  for (const registered of file.entries) {
    const basis = registered.basis;
    if (isAgentAssessmentBasis(basis)) {
      // An assessed entry must still be one entryFromAssessments would build today.
      const rebuilt = entryFromAssessments({
        host: registered.host,
        label: registered.label,
        assessments: basis.assessments,
        reviewedAt: registered.reviewedAt,
      });
      assert.ok(rebuilt.ok, `${registered.host}: ${rebuilt.ok ? '' : rebuilt.reason}`);
    } else {
      assert.match(basis.wikidata, /^Q\d+$/u);
      assert.ok(
        Object.values(basis.authorityIds).filter(Boolean).length > 0,
        `${registered.host} has no authority identifier`,
      );
    }
    assert.equal(registered.sourceClass, ORG_TYPE_SOURCE_CLASS[registered.orgType]);
    assert.ok(
      !registered.host.endsWith('.gov') && !registered.host.endsWith('.mil'),
      `${registered.host} is a government TLD host and does not belong in the register`,
    );
  }
});

const assessment = (overrides: Record<string, unknown> = {}) => ({
  actorId: 'claude-session:claude-sonnet-5-5',
  family: 'anthropic',
  recommendation: 'register' as const,
  orgType: 'encyclopedia' as const,
  reason: 'Nonprofit online encyclopedia of Washington State history with an editorial staff.',
  evidence: [
    {
      url: 'https://www.washington.edu/news/x',
      quote: 'HistoryLink, the free online encyclopedia',
    },
  ],
  ...overrides,
});

test('an assessed entry needs two vendors, two register votes and independent evidence', () => {
  const base = {
    host: 'historylink.org',
    label: 'HistoryLink',
    reviewedAt: '2026-11-25T00:00:00Z',
  };
  const sol = assessment({ actorId: 'codex-review:gpt-6.1-sol', family: 'openai' });
  const ok = entryFromAssessments({ ...base, assessments: [assessment(), sol] });
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.entry.sourceClass, 'reputable_secondary');
  assert.equal(
    ok.ok && ok.entry.reviewedBy,
    'agent assessment: claude-session:claude-sonnet-5-5 + codex-review:gpt-6.1-sol',
  );

  assert.equal(
    entryFromAssessments({ ...base, assessments: [assessment(), assessment()] }).ok,
    false,
  );
  assert.equal(
    entryFromAssessments({
      ...base,
      assessments: [assessment(), { ...sol, recommendation: 'refuse' }],
    }).ok,
    false,
  );
  const selfOnly = {
    ...sol,
    evidence: [{ url: 'https://www.historylink.org/about', quote: 'About us' }],
  };
  assert.equal(entryFromAssessments({ ...base, assessments: [assessment(), selfOnly] }).ok, false);
  const wikipediaOnly = {
    ...sol,
    evidence: [{ url: 'https://en.wikipedia.org/wiki/HistoryLink', quote: 'HistoryLink is' }],
  };
  assert.equal(
    entryFromAssessments({ ...base, assessments: [assessment(), wikipediaOnly] }).ok,
    false,
  );
  const government = { ...sol, orgType: 'government_agency' as const };
  assert.equal(
    entryFromAssessments({ ...base, assessments: [assessment(), government] }).ok,
    false,
  );
});

test('an assessed entry takes the lower of the two classes', () => {
  const result = entryFromAssessments({
    host: 'seattlemedium.com',
    label: 'The Seattle Medium',
    reviewedAt: '2026-11-25T00:00:00Z',
    assessments: [
      assessment({ orgType: 'cultural_institution' }),
      assessment({
        actorId: 'codex-review:gpt-6.1-sol',
        family: 'openai',
        orgType: 'news_publisher',
      }),
    ],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.entry.sourceClass, 'news_reportage');
  assert.equal(result.ok && result.entry.orgType, 'news_publisher');
});
