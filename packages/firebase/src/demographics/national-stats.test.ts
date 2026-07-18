/**
 * Unit tests for publicSourceUrl — display remap that keeps API/download endpoints
 * out of public `/data` citations until Firestore re-ingest stamps owning-body pages.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicSourceUrl } from './national-stats.js';

test('publicSourceUrl maps census API URLs to decade dataset landing pages', () => {
  assert.equal(
    publicSourceUrl({
      source: 'us-census-decennial-2020-pl',
      sourceUrl: 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*',
      decade: '2020',
    }),
    'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
  );
});

test('publicSourceUrl maps ACS API URLs to the ACS program page', () => {
  assert.equal(
    publicSourceUrl({
      source: 'us-census-acs5-2024',
      sourceUrl: 'https://api.census.gov/data/2024/acs/acs5?get=NAME&for=county:*',
    }),
    'https://www.census.gov/programs-surveys/acs',
  );
});

test('publicSourceUrl maps CDE signedurl to the FBI hate-crime hub', () => {
  assert.equal(
    publicSourceUrl({
      source: 'fbi-ucr-hate-crime',
      sourceUrl: 'https://cde.ucr.cjis.gov/LATEST/s3/signedurl?key=additional-datasets/hate-crime/hate_crime.zip',
    }),
    'https://ucr.fbi.gov/hate-crime',
  );
});

test('publicSourceUrl maps Opportunity Atlas S3 CSV to opportunityinsights.org/data/', () => {
  assert.equal(
    publicSourceUrl({
      source: 'opportunity-insights-tract-outcomes',
      sourceUrl:
        'https://opportunityinsightsstatic.s3.us-east-1.amazonaws.com/assets/tract_outcomes_early.csv',
    }),
    'https://opportunityinsights.org/data/',
  );
});
