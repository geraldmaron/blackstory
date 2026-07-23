import assert from 'node:assert/strict';
import test from 'node:test';
import {
  censusPepEstimateYearForBjsReferenceYear,
  censusPepFetchAttemptsForBjsReferenceYear,
  fetchCensusStateRacePopulations,
} from './fetch-census-state-race-populations.js';

test('censusPepEstimateYearForBjsReferenceYear uses January 1 after BJS reference', () => {
  assert.equal(censusPepEstimateYearForBjsReferenceYear(2023), 2024);
});

test('censusPepFetchAttemptsForBjsReferenceYear prefers January then July fallback', () => {
  assert.deepEqual(censusPepFetchAttemptsForBjsReferenceYear(2023), [
    { month: 1, year: 2024 },
    { month: 7, year: 2023 },
  ]);
});

test('fetchCensusStateRacePopulations parses charv rows from mock fetch', async () => {
  const whiteBody = JSON.stringify([
    ['NAME', 'POP', 'state'],
    ['Alabama', '3200000', '01'],
  ]);
  const blackBody = JSON.stringify([
    ['NAME', 'POP', 'state'],
    ['Alabama', '1200000', '01'],
  ]);
  const fetchImpl = async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : url.toString();
    const popGroup = new URL(href).searchParams.get('POPGROUP');
    return new Response(popGroup === '451' ? whiteBody : blackBody, { status: 200 });
  };

  const populations = await fetchCensusStateRacePopulations({
    referenceYear: 2023,
    apiKey: 'test-key',
    fetchImpl,
  });

  assert.equal(populations.get('01')?.whitePopulation, 3_200_000);
  assert.equal(populations.get('01')?.blackPopulation, 1_200_000);
});

test('fetchCensusStateRacePopulations ACS fallback uses B03002 NH White/Black alone', async () => {
  const acsBody = JSON.stringify([
    ['NAME', 'B03002_003E', 'B03002_004E', 'state'],
    ['Illinois', '7500000', '1800000', '17'],
  ]);
  const fetchImpl = async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href.includes('/pep/charv')) {
      return new Response('', { status: 204 });
    }
    assert.match(href, /B03002_003E/);
    assert.match(href, /B03002_004E/);
    assert.doesNotMatch(href, /B03002_005E/);
    assert.doesNotMatch(href, /B03002_014E/);
    return new Response(acsBody, { status: 200 });
  };

  const populations = await fetchCensusStateRacePopulations({
    referenceYear: 2023,
    apiKey: 'test-key',
    fetchImpl,
  });

  assert.equal(populations.get('17')?.whitePopulation, 7_500_000);
  assert.equal(populations.get('17')?.blackPopulation, 1_800_000);
});

test('fetchCensusStateRacePopulations rejects implausible ACS denominators', async () => {
  const acsBody = JSON.stringify([
    ['NAME', 'B03002_003E', 'B03002_004E', 'state'],
    ['Illinois', '8843', '30527', '17'],
  ]);
  const fetchImpl = async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href.includes('/pep/charv')) {
      return new Response('', { status: 204 });
    }
    return new Response(acsBody, { status: 200 });
  };

  await assert.rejects(
    () =>
      fetchCensusStateRacePopulations({
        referenceYear: 2023,
        apiKey: 'test-key',
        fetchImpl,
      }),
    /Implausible ACS\/PEP race denominators/,
  );
});
