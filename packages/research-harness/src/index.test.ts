import { test } from 'node:test';
import assert from 'node:assert';
import { fetchNpsNetworkToFreedom, fetchDplaItems } from './core/connector.js';
import {
  findRelationshipCandidates,
  resolveTemporalWindowsForYear,
  extractYearFromText,
} from './core/adjacency.js';
import {
  enrichSubjectCandidate,
  type EnrichmentBridgeClient,
} from './enrichment/enrichment-bridge.js';

test('NPS Network to Freedom Parser', () => {
  const csvData = `id,name,abstract,latitude,longitude,address,city,county,state,source_url
1,Dunbar High School,"Dunbar was established in 1870 as the first public high school for Black students.",38.909,-77.017,"1301 New Jersey Ave NW",Washington,D.C.,DC,https://nps.gov/dunbar
2,Frederick Douglass House,"Home of the abolitionist Frederick Douglass.",38.862,-76.985,"1411 W St SE",Washington,D.C.,DC,https://nps.gov/douglass
`;

  const results = fetchNpsNetworkToFreedom(csvData);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].title, 'Dunbar High School');
  assert.strictEqual(results[0].connectorKind, 'nps_network_to_freedom');
  assert.strictEqual(results[0].coordinates?.latitude, 38.909);
  assert.strictEqual(results[0].county, 'D.C.');
  assert.strictEqual(results[0].state, 'DC');
  assert.strictEqual(results[0].cites[0], 'https://nps.gov/dunbar');
});

test('DPLA Ingestion Connector', () => {
  const rawDpla = [
    {
      id: 'dpla-1',
      isShownAt: 'https://archive.org/item1',
      sourceResource: {
        title: ['Rosenwald School Listing'],
        description: ['A primary school constructed in 1921.'],
      },
    },
  ];

  const results = fetchDplaItems(rawDpla);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, 'Rosenwald School Listing');
  assert.strictEqual(results[0].cites[0], 'https://archive.org/item1');
});

test('Spatial-Temporal Adjacency Overlaps', () => {
  const subjects = [
    {
      id: 'sub-1',
      connectorKind: 'nps_network_to_freedom' as const,
      title: 'Site A',
      description: 'Active in 1945.',
      coordinates: { latitude: 38.909, longitude: -77.017 },
      cites: [],
      rawRecord: {},
    },
    {
      id: 'sub-2',
      connectorKind: 'nps_network_to_freedom' as const,
      title: 'Site B',
      description: 'Established in 1948.',
      coordinates: { latitude: 38.91, longitude: -77.018 },
      cites: [],
      rawRecord: {},
    },
  ];

  const overlaps = findRelationshipCandidates(subjects, { maxDistanceMeters: 1000 });
  assert.strictEqual(overlaps.length, 1);
  assert.strictEqual(overlaps[0].temporalWindows.includes('20th_century_early'), true);
  assert.ok(overlaps[0].distanceMeters! < 1000);
});

test('Temporal Window Resolution & Year Extraction', () => {
  assert.deepStrictEqual(resolveTemporalWindowsForYear(1940), ['20th_century_early']);
  assert.strictEqual(extractYearFromText('Founded in 1867 in Baltimore'), 1867);
  assert.strictEqual(extractYearFromText('No date here'), undefined);
});

test('undated and unlocated records can yield cross-reference and shared-source leads', () => {
  const ada = {
    id: 'a',
    connectorKind: 'letters',
    title: 'Ada Lovelace',
    description: 'A letter to Charles Babbage.',
    cites: ['https://example.org/letter'],
    rawRecord: {},
  };
  const charles = {
    ...ada,
    id: 'b',
    title: 'Charles Babbage',
    description: 'Correspondence inventory.',
    cites: ['https://example.org/inventory'],
  };
  const other = {
    ...ada,
    id: 'c',
    title: 'Collection inventory',
    description: 'An undated letter.',
  };
  const leads = findRelationshipCandidates([ada, charles, other]);
  assert.deepEqual(leads[0].signals, ['cross_reference']);
  assert.equal(leads[0].subjectB.id, 'b');
  assert.ok(leads.some((lead) => lead.signals.includes('shared_source')));
  assert.ok(leads.every((lead) => lead.distanceMeters === undefined));
  assert.equal(
    findRelationshipCandidates([
      { ...ada, title: 'Ann', description: 'Separate record.' },
      { ...charles, description: 'An annual report.' },
    ]).length,
    0,
  );
});

test('LLM Enrichment Bridge Mock Calling', async () => {
  const mockClient: EnrichmentBridgeClient = {
    async complete(prompt) {
      if (prompt.includes('potential relationship')) {
        return JSON.stringify({
          relationType: 'associated_site',
          confidence: 0.85,
          rationale: 'Mock reason',
        });
      }
      return JSON.stringify({
        title: 'Mock Normalized Title',
        publicSummary: '',
        historicalContext: '',
        confidence: 0.9,
        claims: [],
      });
    },
  };

  const subject = {
    id: 'sub-test',
    connectorKind: 'nps_network_to_freedom' as const,
    title: 'Raw Title',
    description: 'Raw desc',
    coordinates: { latitude: 38.909, longitude: -77.017 },
    cites: [],
    rawRecord: {},
  };

  const enriched = await enrichSubjectCandidate(subject, mockClient, 'housing', 'Chicago');
  assert.strictEqual(enriched.title, 'Mock Normalized Title');
  assert.strictEqual(enriched.confidence, 0.9);
});

test('invalid model output remains intact and cannot be repaired into a candidate', async () => {
  const { InvalidHarnessOutputError } = await import('./enrichment/enrichment-bridge.js');
  const subject = {
    id: 's',
    connectorKind: 'archive',
    title: 'Archive',
    description: 'A joined B.',
    cites: ['https://example.org/minutes'],
    rawRecord: {},
  };
  for (const raw of [
    '```json\n{}\n```',
    '{"confidence":NaN}',
    JSON.stringify({
      title: 'A',
      publicSummary: '',
      historicalContext: '',
      confidence: 2,
      claims: [],
    }),
  ]) {
    await assert.rejects(
      enrichSubjectCandidate(subject, { complete: async () => raw }, 'membership', 'any domain'),
      (error: unknown) => error instanceof InvalidHarnessOutputError && error.rawOutput === raw,
    );
  }
});

test('claim proposals require exact evidence from the cited record', async () => {
  const subject = {
    id: 's',
    connectorKind: 'archive',
    title: 'Minutes',
    description: 'A joined B.',
    cites: ['https://example.org/minutes'],
    rawRecord: {},
  };
  const candidate = {
    title: 'A',
    publicSummary: 'A joined B.',
    historicalContext: '',
    confidence: 0.6,
    claims: [
      {
        id: 'c',
        predicate: 'member_of',
        object: 'B',
        confidence: 0.6,
        evidence: { citationUrl: subject.cites[0], quote: subject.description },
      },
    ],
  };
  let suppliedSchema: unknown;
  const valid = await enrichSubjectCandidate(
    subject,
    {
      complete: async (_prompt, _name, schema) => {
        suppliedSchema = schema;
        return JSON.stringify(candidate);
      },
    },
    'membership',
    'any domain',
  );
  assert.equal(valid.claims.length, 1);
  assert.ok(suppliedSchema);
  for (const evidence of [
    { citationUrl: 'https://invented.invalid/', quote: subject.description },
    { citationUrl: subject.cites[0], quote: 'A founded B.' },
  ]) {
    await assert.rejects(
      enrichSubjectCandidate(
        subject,
        {
          complete: async () =>
            JSON.stringify({ ...candidate, claims: [{ ...candidate.claims[0], evidence }] }),
        },
        'membership',
        'any domain',
      ),
      /same supplied source record/,
    );
  }
});

test('proximity cannot supply missing relationship evidence', async () => {
  const { adjudicateRelationship } = await import('./enrichment/enrichment-bridge.js');
  const a = {
    id: 'a',
    connectorKind: 'archive',
    title: 'A',
    description: 'A joined B.',
    cites: ['https://example.org/minutes'],
    rawRecord: {},
  };
  const b = { ...a, id: 'b', title: 'B' };
  const overlap = {
    subjectA: a,
    subjectB: b,
    signals: ['spatiotemporal'] as const,
    temporalWindows: ['1900s'],
    distanceMeters: 0,
  };
  await assert.rejects(
    adjudicateRelationship(
      overlap,
      {
        complete: async () =>
          JSON.stringify({
            relationType: 'member_of',
            confidence: 0.99,
            rationale: 'Nearby',
            evidence: [],
          }),
      },
      'membership',
      'scope',
    ),
    /requires evidence of the edge/,
  );
  const result = await adjudicateRelationship(
    overlap,
    {
      complete: async () =>
        JSON.stringify({
          relationType: 'none',
          confidence: 0,
          rationale: 'Insufficient evidence',
          evidence: [],
        }),
    },
    'membership',
    'scope',
  );
  assert.equal(result.relationType, 'none');
});

test('DPLA records require stable identifiers and respect the result cap', () => {
  assert.throws(() => fetchDplaItems([{ sourceResource: { title: 'Anonymous' } }]), /stable id/);
  assert.equal(fetchDplaItems([{ id: 'a' }, { id: 'b' }], { limit: 1 }).length, 1);
});

test('NPS CSV preserves quotes and embedded lines instead of losing archival context', () => {
  const rows = fetchNpsNetworkToFreedom(
    'id,name,description,source_url\na,Minutes,"A said ""joined"".\nB signed.",https://example.org/a',
  );
  assert.equal(rows[0]?.description, 'A said "joined".\nB signed.');
  assert.throws(() => fetchNpsNetworkToFreedom('id,name\na,"unfinished'), /unterminated/);
});
