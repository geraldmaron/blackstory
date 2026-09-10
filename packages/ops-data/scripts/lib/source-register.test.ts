/**
 * Register lookup, and the one thing a host allowlist must never get wrong: a look-alike domain
 * borrowing a registered host as a substring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hostMatchesRegisterHost,
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
    assert.match(registered.basis.wikidata, /^Q\d+$/u);
    assert.ok(
      Object.values(registered.basis.authorityIds).filter(Boolean).length > 0,
      `${registered.host} has no authority identifier`,
    );
    assert.equal(registered.sourceClass, ORG_TYPE_SOURCE_CLASS[registered.orgType]);
    assert.ok(
      !registered.host.endsWith('.gov') && !registered.host.endsWith('.mil'),
      `${registered.host} is a government TLD host and does not belong in the register`,
    );
  }
});
