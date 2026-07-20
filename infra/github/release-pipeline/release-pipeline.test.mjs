/**
 * Unit tests for release pipeline helpers (dry-run safe).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertNoAutomaticRollouts } from './lib/auto-rollout-guard.mjs';
import { generateChangelog, resolveCommitMessage } from './lib/changelog.mjs';
import { assertPinnedCommit, buildProvenance, validateProvenance } from './lib/provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FIXTURE_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('buildProvenance validates environment and pinned SHA', async () => {
  const doc = buildProvenance({
    environment: 'staging',
    commitSha: FIXTURE_SHA,
    ref: 'refs/heads/staging',
    repository: 'OWNER/REPO',
    repositoryId: '1',
    ownerId: '2',
    workflow: 'Deploy Staging',
    workflowRef: 'OWNER/REPO/.github/workflows/deploy-staging.yml@refs/heads/staging',
    runId: '99',
    runAttempt: '1',
    serverUrl: 'https://github.com',
    workloadIdentityProvider:
      'projects/332234323945/locations/global/workloadIdentityPools/black-book-github/providers/github-actions',
    serviceAccountEmail: 'github-deploy-staging@black-book-efaaf.iam.gserviceaccount.com',
    deployedAt: '2026-07-17T00:00:00.000Z',
  });
  const result = await validateProvenance(doc);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(assertPinnedCommit(doc), FIXTURE_SHA);
});

test('validateProvenance rejects malformed commit SHA', async () => {
  const doc = buildProvenance({
    environment: 'production',
    commitSha: FIXTURE_SHA,
    ref: 'refs/heads/main',
    repository: 'OWNER/REPO',
    repositoryId: '1',
    ownerId: '2',
    workflow: 'Deploy Production',
    workflowRef: 'OWNER/REPO/.github/workflows/deploy-production.yml@refs/heads/main',
    runId: '1',
    runAttempt: '1',
    serverUrl: 'https://github.com',
    workloadIdentityProvider:
      'projects/332234323945/locations/global/workloadIdentityPools/black-book-github/providers/github-actions',
    serviceAccountEmail: 'github-deploy@black-book-efaaf.iam.gserviceaccount.com',
    deployedAt: '2026-07-17T00:00:00.000Z',
  });
  doc.git.commitSha = 'short';
  const result = await validateProvenance(doc);
  assert.equal(result.ok, false);
});

test('generateChangelog produces markdown for HEAD', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(head.status, 0);
  const sha = head.stdout.trim();
  const markdown = generateChangelog(ROOT, { toSha: sha });
  assert.match(markdown, /^# Changelog/);
  assert.ok(markdown.includes(sha.slice(0, 7)));
});

test('resolveCommitMessage returns subject for HEAD', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const sha = head.stdout.trim();
  const subject = resolveCommitMessage(ROOT, sha);
  assert.ok(subject.length > 0);
});

test('assertNoAutomaticRollouts passes for repo configs and deploy workflows', async () => {
  const result = await assertNoAutomaticRollouts();
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('example provenance fixture validates against schema', async () => {
  const raw = await readFile(
    path.join(ROOT, 'infra/github/release-metadata/example.deployment-provenance.json'),
    'utf8',
  );
  const doc = JSON.parse(raw);
  const result = await validateProvenance(doc);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('rollback dry-run script exits zero with valid SHA', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const sha = head.stdout.trim();
  const result = spawnSync(
    'bash',
    [path.join(ROOT, 'infra/github/release-pipeline/rollback-dry-run.sh'), sha],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY-RUN/);
});
