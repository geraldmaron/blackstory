/**
 * Unit tests for publish-time status linter.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  lintPublishStatus,
  mergePublishStatusLintReports,
  publishStatusLintFailureMessage,
} from './publish-status-linter.ts';

test('lintPublishStatus errors when deceased lexicon conflicts with living status', () => {
  const report = lintPublishStatus({
    entityId: 'ent-person-1',
    kind: 'person',
    summary: 'A'.repeat(120) + ' She died in 1968 after years of activism.',
    status: 'living',
  });
  assert.equal(report.hasErrors, true);
  assert.equal(report.findings[0]?.code, 'person_deceased_lexicon_vs_living');
});

test('lintPublishStatus passes when deceased lexicon matches deceased status', () => {
  const report = lintPublishStatus({
    entityId: 'ent-person-2',
    kind: 'person',
    summary: 'A'.repeat(120) + ' He died in 1968.',
    status: 'deceased',
    livingStatus: 'deceased',
  });
  assert.equal(report.hasErrors, false);
});

test('lintPublishStatus warns when law summary self-describes repeal but status is in_force', () => {
  const report = lintPublishStatus({
    entityId: 'ent-law-1',
    kind: 'law',
    summary: 'A'.repeat(120) + ' The statute was struck down by the Supreme Court in 1971.',
    status: 'in_force',
  });
  assert.equal(report.hasErrors, false);
  assert.equal(report.hasWarnings, true);
  assert.equal(report.findings[0]?.code, 'law_self_demise_vs_in_force');
});

test('mergePublishStatusLintReports combines findings', () => {
  const merged = mergePublishStatusLintReports([
    lintPublishStatus({
      entityId: 'ent-law-1',
      kind: 'law',
      summary: 'A'.repeat(120) + ' repealed in 1980.',
      status: 'in_force',
    }),
    lintPublishStatus({
      entityId: 'ent-place-1',
      kind: 'place',
      summary: 'A'.repeat(130),
      status: 'active',
    }),
  ]);
  assert.equal(merged.hasWarnings, true);
  assert.equal(merged.hasErrors, false);
  assert.equal(merged.findings.length, 1);
});

test('publishStatusLintFailureMessage summarizes blocking errors', () => {
  const report = lintPublishStatus({
    entityId: 'ent-person-1',
    kind: 'person',
    summary: 'A'.repeat(120) + ' assassinated in 1965.',
    status: 'living',
  });
  const message = publishStatusLintFailureMessage(report);
  assert.match(message, /blocked 1 entity/);
  assert.match(message, /ent-person-1/);
});
