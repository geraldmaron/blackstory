import { test } from 'node:test';
import assert from 'node:assert';
import {
  fetchNpsNetworkToFreedom,
  fetchDplaItems,
} from './core/connector.js';
import {
  findSpatialTemporalOverlaps,
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
      coordinates: { latitude: 38.910, longitude: -77.018 },
      cites: [],
      rawRecord: {},
    },
  ];

  const overlaps = findSpatialTemporalOverlaps(subjects, { maxDistanceMeters: 1000 });
  assert.strictEqual(overlaps.length, 1);
  assert.strictEqual(overlaps[0].temporalWindows.includes('20th_century_early'), true);
  assert.ok(overlaps[0].distanceMeters! < 1000);
});

test('Temporal Window Resolution & Year Extraction', () => {
  assert.deepStrictEqual(resolveTemporalWindowsForYear(1940), ['20th_century_early']);
  assert.strictEqual(extractYearFromText('Founded in 1867 in Baltimore'), 1867);
  assert.strictEqual(extractYearFromText('No date here'), undefined);
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
        publicSummary: 'Mock summary',
        historicalContext: 'Mock context',
        latitude: 38.909,
        longitude: -77.017,
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
