
/**
 * Unit tests for recovery rehearsal dry-run helpers.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PATHS,
  assertBreakGlassPath,
  buildTimingReport,
  getProcedureSteps,
  readJson,
  validateTimingReport,
  verifyStep,
} from './lib/rehearsal.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('checklist has ordered recovery procedures', async () => {
  const checklist = await readJson(DEFAULT_PATHS.checklist);
  const steps = getProcedureSteps(checklist);
  assert.ok(steps.length >= 9);
  assert.equal(steps[0].order, 1);
  const ids = steps.map((s) => s.id);
  assert.ok(ids.includes('database-restore'));
  assert.ok(ids.includes('active-release-rollback'));
  assert.ok(ids.includes('revoke-compromised-deploy-identity'));
});

test('break-glass path rejects compromised identity for recovery', async () => {
  const [checklist, scenario, breakGlass] = await Promise.all([
    readJson(DEFAULT_PATHS.checklist),
    readJson(DEFAULT_PATHS.scenario),
    readJson(DEFAULT_PATHS.breakGlass),
  ]);
  const revokeStep = getProcedureSteps(checklist, 'revoke-compromised-deploy-identity')[0];
  const result = assertBreakGlassPath(revokeStep, scenario, breakGlass);
  assert.equal(result.ok, true);
  assert.ok(revokeStep.mustNotUse.includes('github-deploy'));
});

test('verifyStep passes database restore against BB-020 fixtures', async () => {
  const [checklist, scenario, breakGlass] = await Promise.all([
    readJson(DEFAULT_PATHS.checklist),
    readJson(DEFAULT_PATHS.scenario),
    readJson(DEFAULT_PATHS.breakGlass),
  ]);
  const step = getProcedureSteps(checklist, 'database-restore')[0];
  const result = await verifyStep(step, scenario, breakGlass);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('verifyStep passes active release rollback for prior release fixture', async () => {
  const [checklist, scenario, breakGlass] = await Promise.all([
    readJson(DEFAULT_PATHS.checklist),
    readJson(DEFAULT_PATHS.scenario),
    readJson(DEFAULT_PATHS.breakGlass),
  ]);
  const step = getProcedureSteps(checklist, 'active-release-rollback')[0];
  const result = await verifyStep(step, scenario, breakGlass);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('buildTimingReport records measured minutes from fixtures', async () => {
  const [checklist, scenario, timingMatrix] = await Promise.all([
    readJson(DEFAULT_PATHS.checklist),
    readJson(DEFAULT_PATHS.scenario),
    readJson(DEFAULT_PATHS.timingMatrix),
  ]);
  const steps = getProcedureSteps(checklist);
  const report = buildTimingReport(steps, scenario, timingMatrix, Date.now());
  assert.ok(report.procedures.length >= 9);
  assert.ok(report.totalMeasuredMinutes > 0);
  for (const proc of report.procedures) {
    assert.ok(proc.measuredMinutes > 0);
    assert.ok(proc.durationMs > 0);
    assert.ok(!proc.breakGlassIdentity?.includes('github-deploy'));
  }
  const validation = validateTimingReport(report);
  assert.equal(validation.ok, true, validation.errors.join('; '));
});

test('run-rehearsal integration writes report fixture', async () => {
  const reportPath = path.join(FIXTURES, 'last-rehearsal-report.json');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(report.bead, 'BB-061');
  assert.ok(Array.isArray(report.procedures));
});
