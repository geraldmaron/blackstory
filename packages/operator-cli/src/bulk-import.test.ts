/**
 * Verifies CSV/markdown bulk-import parsing and the per-row batch runner.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseLeadsFromCsv,
  parseLeadsFromMarkdown,
  prepareBulkLeadIntake,
  type BulkImportSummary,
} from './bulk-import.ts';
import type { OperatorIntakeContext } from './intake.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-bulk-01',
  source: 'cli' as const,
};

function context(): OperatorIntakeContext {
  return {
    identity: IDENTITY,
    privacyPepper: 'test-only-pepper',
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
  };
}

const CSV = [
  'title,description,url,location,era',
  '"Douglass Ave office","A photo shows the mutual-aid office plaque, dated 1962.",https://archive.example.org/a,Douglass Avenue,1960s',
  ',"A second lead with no title field, but a valid description of sufficient length.",https://archive.example.org/b,,',
].join('\n');

test('parses a CSV bulk-import batch into LeadInput rows', () => {
  const leads = parseLeadsFromCsv(CSV);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.title, 'Douglass Ave office');
  assert.equal(leads[0]?.url, 'https://archive.example.org/a');
  assert.equal(leads[0]?.location, 'Douglass Avenue');
  assert.equal(leads[1]?.title, undefined);
  assert.equal(leads[1]?.url, 'https://archive.example.org/b');
});

const MARKDOWN = `# Operator lead batch

### Douglass Ave office
Description: A photo shows the mutual-aid office plaque, dated 1962.
It was found in a digitized 1962 city newspaper archive.
Source: https://archive.example.org/a
Location: Douglass Avenue
Era: 1960s

### Second lead
Description: A second lead with a valid, sufficiently long description of its own.
Source: https://archive.example.org/b
Source: https://archive.example.org/b2
`;

test('parses a markdown bulk-import batch, including multi-line description and repeated sources', () => {
  const leads = parseLeadsFromMarkdown(MARKDOWN);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.title, 'Douglass Ave office');
  assert.ok(leads[0]?.description.includes('digitized 1962 city newspaper archive'));
  assert.deepEqual(leads[1]?.sourceUrls, [
    'https://archive.example.org/b',
    'https://archive.example.org/b2',
  ]);
});

test('bulk-import runs every parsed row through the same real intake path, one at a time', () => {
  const leads = parseLeadsFromMarkdown(MARKDOWN);
  const summary: BulkImportSummary = prepareBulkLeadIntake(leads, context());
  assert.equal(summary.total, 2);
  assert.equal(summary.acceptedCount, 2);
  assert.equal(summary.rejectedCount, 0);
  for (const row of summary.rows) {
    assert.equal(row.proposalKind, 'bulk_import_row');
    if (row.accepted) {
      assert.ok(row.researchCase, 'bulk rows open a draft research case, like single leads');
    }
  }
});

test('a bad row in a batch is rejected individually without blocking the rest of the batch', () => {
  const leads = [
    { description: 'Valid lead with a citation.', url: 'https://archive.example.org/ok' },
    { description: 'No citation at all here, should fail BB-029 validation cleanly.' },
  ];
  const summary = prepareBulkLeadIntake(leads, context());
  assert.equal(summary.total, 2);
  assert.equal(summary.acceptedCount, 1);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.rows[0]?.accepted, true);
  assert.equal(summary.rows[1]?.accepted, false);
});
