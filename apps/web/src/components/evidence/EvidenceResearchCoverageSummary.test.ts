/**
 * SSR markup smoke tests for the record-level research-coverage source-lineage
 * retraction summary.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { EvidenceResearchCoverageSummary } from './EvidenceResearchCoverageSummary';

test('renders the research coverage level, source lineage count, and last-checked date', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceResearchCoverageSummary, {
      researchCoverage: { level: 'partial', lastCheckedAt: '2026-06-01T00:00:00.000Z' },
      sourceLineage: { independentLineageCount: 3 },
    }),
  );
  assert.match(html, /Partial/);
  assert.match(html, /3.*independent.*sources/s);
  assert.match(html, /Last checked/);
  assert.match(html, /2026-06-01/);
});

test('renders record-level retraction notices distinctly from research coverage', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceResearchCoverageSummary, {
      researchCoverage: { level: 'minimal' },
      retractionNotices: [
        {
          retractedAt: '2026-07-10T00:00:00.000Z',
          reason: 'The sole supporting source was later retracted by its publisher.',
        },
      ],
    }),
  );
  assert.match(html, /Retracted 2026-07-10/);
  assert.match(html, /The sole supporting source was later retracted by its publisher\./);
});

test('renders no retraction notices block when none are supplied', () => {
  const html = renderToStaticMarkup(
    createElement(EvidenceResearchCoverageSummary, { researchCoverage: { level: 'substantial' } }),
  );
  assert.doesNotMatch(html, /Retracted/);
});
