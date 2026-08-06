/**
 * Unit tests for the content-expectations triage mapping.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditProjection,
  countDistinctSources,
  citationPublisher,
  summarizeAudits,
  type AuditableProjection,
} from './entity-content-audit.ts';

const claim = (href: string | undefined, source = 'Some Source') => ({
  id: 'c1',
  predicate: 'documented_site',
  object: 'something',
  confidenceLevel: 'high',
  citationSource: source,
  ...(href !== undefined ? { citationHref: href } : {}),
});

test('citationPublisher normalizes host and drops the www prefix', () => {
  assert.equal(citationPublisher(claim('https://www.NPGallery.nps.gov/x/y')), 'npgallery.nps.gov');
});

test('citationPublisher falls back to the text source when the href is unusable', () => {
  assert.equal(citationPublisher(claim('not-a-url', 'NPGallery')), 'npgallery');
});

test('countDistinctSources counts publishers, not documents', () => {
  // The registry index entry and the nomination form are two documents from one agency. They
  // do not corroborate each other, so the corroboration check must see a single source.
  const claims = [
    claim('https://npgallery.nps.gov/AssetDetail/NRIS/71000836'),
    claim('https://npgallery.nps.gov/NRHP/GetAsset/NRHP/71000836_text'),
  ];
  assert.equal(countDistinctSources(claims), 1);
});

test('countDistinctSources counts genuinely independent publishers separately', () => {
  const claims = [
    claim('https://npgallery.nps.gov/AssetDetail/NRIS/71000836'),
    claim('https://chroniclingamerica.loc.gov/lccn/sn83045433/1953-06-09/ed-1/seq-1/'),
  ];
  assert.equal(countDistinctSources(claims), 2);
});

test('countDistinctSources treats a non-array claims value as zero sources', () => {
  // Four released entities store claims as a jsonb object rather than an array (repo-n7p6.14).
  assert.equal(countDistinctSources({}), 0);
  assert.equal(countDistinctSources(undefined), 0);
});

const thinPlace: AuditableProjection = {
  id: 'nrhp-black-heritage-71000836',
  kind: 'place',
  researchCoverage: 'minimal',
  claims: [claim('https://npgallery.nps.gov/AssetDetail/NRIS/71000836')],
};

test('auditProjection marks a single-source registry place as needs_work', () => {
  const audit = auditProjection(thinPlace);
  assert.ok(audit);
  assert.equal(audit!.verdict, 'needs_work');
  assert.deepEqual([...audit!.result.failedCheckIds].sort(), [
    'distinct_sources',
    'narrative_paragraphs',
    'research_coverage',
  ]);
});

test('auditProjection passes a place with context and two independent publishers', () => {
  const audit = auditProjection({
    ...thinPlace,
    researchCoverage: 'partial',
    historicalContext:
      'The bank opened in 1946 because Black Memphians could not get mortgages downtown, and its ' +
      'directors underwrote the boycott that followed the 1968 sanitation strike.',
    claims: [
      claim('https://npgallery.nps.gov/AssetDetail/NRIS/71000836'),
      claim('https://chroniclingamerica.loc.gov/lccn/sn83045433/1953-06-09/ed-1/seq-1/'),
    ],
  });
  assert.ok(audit);
  assert.equal(audit!.verdict, 'meets_bar');
  assert.deepEqual(audit!.result.failedCheckIds, []);
});

test('auditProjection returns null for a kind outside the public ontology', () => {
  assert.equal(auditProjection({ id: 'x', kind: 'spaceship' }), null);
  assert.equal(auditProjection({ kind: 'place' }), null);
});

test('summarizeAudits ranks failed checks by how many records they block', () => {
  const audits = [
    auditProjection(thinPlace)!,
    auditProjection({ ...thinPlace, id: 'b' })!,
    auditProjection({
      ...thinPlace,
      id: 'c',
      researchCoverage: 'partial',
      historicalContext: 'A'.repeat(60),
      claims: [claim('https://npgallery.nps.gov/x'), claim('https://loc.gov/y')],
    })!,
  ];
  const summary = summarizeAudits(audits, 4);
  assert.equal(summary.total, 4);
  assert.equal(summary.audited, 3);
  assert.equal(summary.unauditable, 1);
  assert.equal(summary.meetsBar, 1);
  assert.equal(summary.needsWork, 2);
  assert.equal(summary.failuresByCheck[0]?.count, 2);
  assert.equal(summary.byKind[0]?.kind, 'place');
});
