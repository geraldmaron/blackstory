/**
 * Tests for DSL Renewing Inequality Chicago urban renewal attribute parsing and draft mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  DSL_RENEWING_INEQUALITY_ATTRIBUTION_NOTE,
  DSL_RENEWING_INEQUALITY_HOMEPAGE_URL,
  DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL,
  PHASE1_UR_NONWHITE_FAMILIES_PROJECT_METRIC_ID,
} from './constants.js';
import { fetchChicagoUrbanRenewalProjects } from './fetch-chicago-projects.js';
import {
  buildChicagoUrbanRenewalProjects,
  countChicagoUrbanRenewalProjects,
  filterChicagoUrbanRenewalRows,
  mapChicagoProjectsToArtifactDrafts,
  mapChicagoProjectsToObservationDrafts,
  parseDslRenewingInequalityAttributeCsv,
} from './chicago-project-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators/dsl-renewing-inequality-chicago-attributes-sample.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseDslRenewingInequalityAttributeCsv reads Renewing Inequality attribute rows', () => {
  const { rows, rejected } = parseDslRenewingInequalityAttributeCsv(SAMPLE_CSV);
  assert.equal(rejected.length, 0);
  assert.ok(rows.length > 0);
  assert.equal(rows[0]?.city.toLowerCase(), 'chicago');
  assert.equal(rows[0]?.state.toLowerCase(), 'il');
});

test('filterChicagoUrbanRenewalRows keeps Chicago IL rows in 1955-1966 only', () => {
  const { rows } = parseDslRenewingInequalityAttributeCsv(SAMPLE_CSV);
  const chicagoRows = filterChicagoUrbanRenewalRows(rows);
  assert.ok(chicagoRows.every((row) => row.city.toLowerCase() === 'chicago'));
  assert.ok(chicagoRows.every((row) => row.year >= 1955 && row.year <= 1966));
});

test('buildChicagoUrbanRenewalProjects collapses to five curated pilot projects', () => {
  const { rows } = parseDslRenewingInequalityAttributeCsv(SAMPLE_CSV);
  const projects = buildChicagoUrbanRenewalProjects(filterChicagoUrbanRenewalRows(rows));
  assert.equal(countChicagoUrbanRenewalProjects(projects), 5);
  const nearWest = projects.find((project) => project.projectId === '2474');
  assert.ok(nearWest);
  assert.equal(nearWest?.projectName, 'near west side');
  assert.equal(nearWest?.nonwhiteFamilies, 126);
});

test('mapChicagoProjectsToObservationDrafts emits staff-research provenance', () => {
  const { rows } = parseDslRenewingInequalityAttributeCsv(SAMPLE_CSV);
  const projects = buildChicagoUrbanRenewalProjects(filterChicagoUrbanRenewalRows(rows));
  const hydePark = projects.find((project) => project.projectId === '2466');
  assert.ok(hydePark);
  const drafts = mapChicagoProjectsToObservationDrafts([hydePark!], RETRIEVED_AT);
  const acquired = drafts.find(
    (draft) => draft.metricId === PHASE1_UR_NONWHITE_FAMILIES_PROJECT_METRIC_ID,
  );
  assert.ok(acquired);
  assert.equal(acquired.jurisdictionId, 'ur-project:2466');
  assert.equal(acquired.estimate, 2333);
  assert.equal(acquired.source, 'dsl-renewing-inequality');
  assert.equal(acquired.sourceUrl, DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL);
  assert.equal(acquired.attributionNote, DSL_RENEWING_INEQUALITY_ATTRIBUTION_NOTE);
  assert.equal(acquired.surfacePolicy, 'staff_research');
  assert.match(acquired.contentHash, /^[a-f0-9]{64}$/);
});

test('mapChicagoProjectsToArtifactDrafts is cite-only and references DSL homepage', () => {
  const { rows } = parseDslRenewingInequalityAttributeCsv(SAMPLE_CSV);
  const projects = buildChicagoUrbanRenewalProjects(filterChicagoUrbanRenewalRows(rows));
  const artifacts = mapChicagoProjectsToArtifactDrafts(projects.slice(0, 1));
  assert.equal(artifacts.length, 2);
  assert.equal(artifacts[0]?.surfacePolicy, 'cite_only_public');
  assert.equal(artifacts[0]?.sourceUrl, DSL_RENEWING_INEQUALITY_HOMEPAGE_URL);
  assert.match(artifacts[0]?.uncertaintyLabel ?? '', /rights review/i);
  assert.equal(artifacts[1]?.artifactClass, 'primary_government_document');
});

test('fetchChicagoUrbanRenewalProjects uses fixture csvText without network', async () => {
  const result = await fetchChicagoUrbanRenewalProjects({
    csvText: SAMPLE_CSV,
    retrievedAt: RETRIEVED_AT,
    fetchImpl: async () => {
      throw new Error('network should not be called when csvText is provided');
    },
  });
  assert.equal(result.chicagoProjectCount, 5);
  assert.ok(result.observations.length > 0);
  assert.equal(result.artifacts.length, result.chicagoProjectCount + 1);
  assert.ok(result.observations.every((obs) => obs.source === 'dsl-renewing-inequality'));
});
