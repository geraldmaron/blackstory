/**
 * SSR markup smoke tests for the top-level `EntityEvidencePanel` export the component the
 * parent entity page mounts. Confirms the panel renders the measurement legend, a record-level
 * coverage summary, one card per claim (or the approved gap notice when there are none), and that
 * a record-level source-lineage rollup derives correctly from per-claim data when not supplied
 * explicitly.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { EvidenceClaimInput } from '../../lib/evidence';
import { EntityEvidencePanel } from './EntityEvidencePanel';

const CLAIMS: readonly EvidenceClaimInput[] = [
  {
    id: 'claim_seed_001',
    predicate: 'founded_year',
    object: '1867',
    confidenceScore: 0.78,
    confidenceLevel: 'high',
    citation: { source: 'National Archives (seed)', label: 'Primary archival', href: 'https://catalog.archives.gov/' },
    sourceLineage: { independentLineageCount: 2 },
  },
  {
    id: 'claim_seed_005',
    predicate: 'documented_dispute',
    object: 'Contested 1920s land-use displacement action',
    confidenceScore: 0.66,
    confidenceLevel: 'medium',
    citation: { source: 'D.C. Historical Society (seed)', label: 'Reputable secondary' },
    sourceLineage: { independentLineageCount: 1 },
  },
];

test('renders the measurement legend distinguishing all four dimensions (AC2)', () => {
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: CLAIMS,
      researchCoverage: { level: 'partial' },
    }),
  );
  assert.match(html, /How to read this record.{0,10}s measurements/);
  assert.match(html, /Confidence.{0,20}evidence score/);
  assert.match(html, /Relevance/);
  assert.match(html, /Connection strength/);
  assert.match(html, /Research coverage/);
});

test('renders one evidence card per claim', () => {
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: CLAIMS,
      researchCoverage: { level: 'partial' },
    }),
  );
  assert.match(html, /id="claim_seed_001"/);
  assert.match(html, /id="claim_seed_005"/);
});

test('derives the record-level source-lineage rollup from claims when not supplied explicitly', () => {
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: CLAIMS,
      researchCoverage: { level: 'partial' },
    }),
  );
  // 2 (claim_seed_001) + 1 (claim_seed_005) = 3 independent sources at the record level.
  assert.match(html, /3.*independent.*sources/s);
});

test('uses distinct citation sources when claims lack sourceLineage', () => {
  const citationOnlyClaims: readonly EvidenceClaimInput[] = CLAIMS.map((claim) => {
    const { sourceLineage: _omit, ...rest } = claim;
    return rest;
  });
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: citationOnlyClaims,
      researchCoverage: { level: 'partial' },
    }),
  );
  assert.match(html, /<span class="bb-mono">2<\/span> independent sources/s);
  assert.doesNotMatch(html, /<span class="bb-mono">0<\/span> independent/);
});

test('does not render independent source lineage when no lineage or citation signal exists', () => {
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: [
        {
          id: 'claim_empty_cite',
          predicate: 'note',
          object: 'Placeholder',
          confidenceScore: 0.4,
          confidenceLevel: 'low',
          citation: { source: '   ', label: 'Pending' },
        },
      ],
      researchCoverage: { level: 'minimal' },
    }),
  );
  assert.doesNotMatch(html, /independent.*sources/s);
});

test('renders the approved gap notice, not a bare empty list, when there are no claims', () => {
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: [],
      researchCoverage: { level: 'none' },
    }),
  );
  assert.match(html, /No accepted claims yet/);
  assert.doesNotMatch(html, /id="claim_seed_001"/);
});

test('renders record-level retraction notices when supplied', () => {
  const html = renderToStaticMarkup(
    createElement(EntityEvidencePanel, {
      labelledBy: 'evidence-heading',
      claims: CLAIMS,
      researchCoverage: { level: 'partial' },
      retractionNotices: [
        { retractedAt: '2026-07-10T00:00:00.000Z', reason: 'A key supporting source was later retracted.' },
      ],
    }),
  );
  assert.match(html, /Retracted 2026-07-10/);
  assert.match(html, /A key supporting source was later retracted\./);
});
