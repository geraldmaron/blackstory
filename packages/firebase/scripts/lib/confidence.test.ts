/**
 * Regression tests for corsair confidence wiring: host classification and the
 * multi-source publish threshold used by auto-promote / rejudge gates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySourceForConfidence,
  computeClaimConfidence,
} from './confidence.ts';

const DC_PRESERVATION =
  'https://historicsites.dcpreservation.org/site/123-example-historic-place';
const NPS_GOV = 'https://www.nps.gov/places/example-historic-site.htm';
const WIKIPEDIA = 'https://en.wikipedia.org/wiki/Example_Historic_Site';

test('classifySourceForConfidence maps curated heritage hosts to reputable_secondary', () => {
  assert.equal(classifySourceForConfidence(DC_PRESERVATION), 'reputable_secondary');
  assert.equal(classifySourceForConfidence('https://www.hmdb.org/m.asp?m=12345'), 'reputable_secondary');
  assert.equal(classifySourceForConfidence('https://digdc.dclibrary.org/islandora/object/pdc%3A123'), 'reputable_secondary');
  assert.equal(classifySourceForConfidence('https://www.blackpast.org/african-american-history/example/'), 'reputable_secondary');
});

test('classifySourceForConfidence keeps gov and wikipedia behavior', () => {
  assert.equal(classifySourceForConfidence(NPS_GOV), 'government_record');
  assert.equal(classifySourceForConfidence(WIKIPEDIA), 'reputable_secondary');
  assert.equal(classifySourceForConfidence('https://example.com/article'), 'unknown');
});

test('historicsites.dcpreservation.org alone scores 0.72 — below standardPublish', () => {
  const result = computeClaimConfidence('claim-dc-only', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
  ]);
  assert.equal(result.score, 0.72);
  assert.equal(result.passesPublishThreshold, false);
  assert.equal(result.threshold, 0.75);
  assert.equal(result.independentLineageCount, 1);
});

test('dcpreservation + nps.gov clears standardPublish via corroboration', () => {
  const result = computeClaimConfidence('claim-dc-nps', [
    { url: DC_PRESERVATION, textContainsSubjectName: true },
    { url: NPS_GOV, textContainsSubjectName: true },
  ]);
  assert.ok(result.score >= 0.75);
  assert.equal(result.passesPublishThreshold, true);
  assert.equal(result.independentLineageCount, 2);
});

test('wikipedia-only stays below standardPublish', () => {
  const result = computeClaimConfidence('claim-wiki-only', [
    { url: WIKIPEDIA, textContainsSubjectName: true },
  ]);
  assert.equal(result.score, 0.72);
  assert.equal(result.passesPublishThreshold, false);
});

test('wikipedia + nps.gov clears standardPublish', () => {
  const result = computeClaimConfidence('claim-wiki-nps', [
    { url: WIKIPEDIA, textContainsSubjectName: true },
    { url: NPS_GOV, textContainsSubjectName: true },
  ]);
  assert.ok(result.score >= 0.75);
  assert.equal(result.passesPublishThreshold, true);
});
