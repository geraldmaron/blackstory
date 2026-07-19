/**
 * beta launch gate tests fail-closed human attestations and non-zero exit on NO_GO.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadHumanAttestationBundle, validateBetaLaunchDecisionArtifact } from './artifact.js';
import {
  evaluateBetaLaunchGate,
  exitCodeForDecision,
  missingHumanAttestations,
} from './evaluate.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..');
const fixtureDir = join(repoRoot, 'packages', 'testing', 'src', 'launch-gate', 'fixtures');
const scriptPath = join(repoRoot, 'scripts', 'launch', 'evaluate-beta-gate.mjs');

describe('evaluateBetaLaunchGate', () => {
  it('returns NO_GO when required human attestations are missing (fail-closed)', () => {
    const report = evaluateBetaLaunchGate({
      repoRoot,
      evaluator: 'test-harness',
      evaluatedAt: '2026-07-17T12:00:00.000Z',
    });
    assert.equal(report.decision, 'NO_GO');
    assert.ok(report.requiredFailed > 0);
    const humanFailures = report.gates.filter(
      (gate) => gate.kind === 'human' && gate.status === 'fail',
    );
    assert.ok(humanFailures.length >= 7);
    assert.ok(
      humanFailures.every((gate) => gate.message.includes('fail-closed')),
      'human gates must fail-closed without attestation',
    );
  });

  it('returns GO when machine checks pass and all human gates are attested', () => {
    const attestations = loadHumanAttestationBundle(join(fixtureDir, 'all-pass-attestations.json'));
    const report = evaluateBetaLaunchGate({
      repoRoot,
      evaluator: 'test-harness',
      evaluatedAt: '2026-07-17T12:00:00.000Z',
      attestations,
    });
    assert.equal(report.decision, 'GO');
    assert.equal(report.requiredFailed, 0);
    assert.ok(report.requiredPassed >= 15);
    validateBetaLaunchDecisionArtifact(report);
  });

  it('lists missing human gate ids for partial attestation bundles', () => {
    const attestations = loadHumanAttestationBundle(join(fixtureDir, 'partial-attestations.json'));
    const missing = missingHumanAttestations(attestations);
    assert.ok(missing.length >= 6);
    assert.ok(!missing.includes('published-claims-with-evidence'));
  });
});

test('exitCodeForDecision returns non-zero on NO_GO', () => {
  assert.equal(exitCodeForDecision('GO'), 0);
  assert.equal(exitCodeForDecision('NO_GO'), 1);
});

test('CLI exits non-zero without attestations and zero with all-pass fixture', () => {
  const noAttest = spawnSync(process.execPath, [scriptPath, '--evaluator', 'cli-test'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.notEqual(noAttest.status, 0, 'missing attestations must block launch');

  const outputDir = mkdtempSync(join(tmpdir(), 'beta-gate-'));
  const outputPath = join(outputDir, 'decision.json');
  const allPass = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--evaluator',
      'cli-test',
      '--attestations',
      join(fixtureDir, 'all-pass-attestations.json'),
      '--output',
      outputPath,
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  assert.equal(allPass.status, 0, 'all-pass fixture must yield GO exit code');
  const artifact = JSON.parse(readFileSync(outputPath, 'utf8')) as { decision: string };
  assert.equal(artifact.decision, 'GO');
});
