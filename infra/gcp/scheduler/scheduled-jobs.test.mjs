/**
 * Acceptance checks for the declarative Cloud Scheduler mirror. Validates shape only
 * (no live GCP calls, no cross-package dynamic import — mirrors infra/gcp/cost-controls/
 * cost-controls.test.mjs, which validates its JSON standalone against the shipped cost-control
 * values by hand-kept-in-sync convention, not a build-time import).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(__dirname, relativePath), 'utf8'));
}

describe('BB-084 scheduled-jobs Cloud Scheduler mirror', () => {
  it('declares BB-084, design status, and the internal environment', () => {
    const config = readJson('scheduled-jobs.json');
    assert.equal(config.bead, 'BB-084');
    assert.equal(config.status, 'design');
    assert.equal(config.environment, 'blackbook-internal');
    assert.equal(config.policyPackageRef, 'packages/config/src/scheduled-jobs/roster.ts');
  });

  it('has at least 14 jobs, all with unique ids', () => {
    const config = readJson('scheduled-jobs.json');
    assert.ok(config.jobs.length >= 14);
    const ids = config.jobs.map((job) => job.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('every job declares owner, cadence, budget, timeout, idempotency scheme, kill switch, and target worker', () => {
    const config = readJson('scheduled-jobs.json');
    for (const job of config.jobs) {
      assert.ok(job.owner, `${job.id} missing owner`);
      assert.ok(job.cronExpression, `${job.id} missing cronExpression`);
      assert.ok(job.budget?.unit && job.budget.maxPerRun > 0, `${job.id} missing/invalid budget`);
      assert.ok(job.timeoutSec > 0 && job.timeoutSec <= 86_400, `${job.id} invalid timeoutSec`);
      assert.ok(job.idempotencyKeyScheme?.includes('{jobId}'), `${job.id} idempotencyKeyScheme missing {jobId}`);
      assert.ok(job.killSwitchId, `${job.id} missing killSwitchId`);
      assert.ok(
        ['research', 'publication', 'security'].includes(job.targetWorker?.package),
        `${job.id} targetWorker.package must be research/publication/security (ADR-007)`,
      );
      assert.ok(job.targetWorker?.function, `${job.id} missing targetWorker.function`);
    }
  });

  it('every stub declares which bead owns the real implementation', () => {
    const config = readJson('scheduled-jobs.json');
    for (const job of config.jobs.filter((j) => j.rosterStatus === 'stub')) {
      assert.ok(job.implementationOwnerBead, `${job.id} stub missing implementationOwnerBead`);
    }
  });

  it('only the two pre-approved jobs declare an automatic public-facing effect', () => {
    const config = readJson('scheduled-jobs.json');
    const withEffect = config.jobs
      .filter((job) => job.publicEffect !== 'none')
      .map((job) => [job.id, job.publicEffect])
      .sort();
    assert.deepEqual(withEffect, [
      ['citation-link-health-sweep', 'link-repair-archived-copy'],
      ['release-coupled-rebuild', 'release-coupled-rebuild'],
    ]);
  });

  it('exactly four jobs are marked real, matching the wired job bodies under packages/config/src/scheduled-jobs/jobs/', () => {
    const config = readJson('scheduled-jobs.json');
    const real = config.jobs.filter((job) => job.rosterStatus === 'real').map((job) => job.id).sort();
    assert.deepEqual(real, [
      'backup-verification-daily',
      'gold-corpus-regression',
      'restore-drill-quarterly',
      'source-drift-run-health-check',
    ]);
  });

  it('discovery-campaign jobs share the research-campaigns kill switch', () => {
    const config = readJson('scheduled-jobs.json');
    const discoveryJobs = config.jobs.filter((job) => job.id.startsWith('discovery-campaign-'));
    assert.ok(discoveryJobs.length >= 4);
    for (const job of discoveryJobs) {
      assert.equal(job.killSwitchId, 'research-campaigns');
    }
  });

  it('validates against the JSON Schema structurally (required fields, enums, patterns)', () => {
    const config = readJson('scheduled-jobs.json');
    const schema = readJson('scheduled-jobs.schema.json');
    // Lightweight structural check (no ajv dependency) mirroring the level of validation
    // infra/gcp/cost-controls/cost-controls.test.mjs already performs for its sibling schema.
    assert.equal(config.version, schema.properties.version.const);
    assert.equal(config.status, schema.properties.status.const);
    assert.equal(config.bead, schema.properties.bead.const);
    assert.equal(config.environment, schema.properties.environment.const);
    for (const job of config.jobs) {
      assert.match(job.id, new RegExp(schema.properties.jobs.items.properties.id.pattern));
      assert.ok(schema.properties.jobs.items.properties.rosterStatus.enum.includes(job.rosterStatus));
      assert.ok(schema.properties.jobs.items.properties.publicEffect.enum.includes(job.publicEffect));
    }
  });
});
