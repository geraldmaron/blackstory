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
import { BETA_LAUNCH_GATES, REQUIRED_HUMAN_GATE_IDS } from './criteria.js';
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
    // Derived, not hardcoded: a GO with zero required failures means every required gate passed,
    // so this stays true when a gate is added or downgraded to optional. The previous
    // `>= 15` silently stopped meaning "all of them" the moment the gate count changed.
    assert.equal(report.requiredPassed, BETA_LAUNCH_GATES.filter((gate) => gate.required).length);
    validateBetaLaunchDecisionArtifact(report);
  });

  it('lists missing human gate ids for partial attestation bundles', () => {
    const attestations = loadHumanAttestationBundle(join(fixtureDir, 'partial-attestations.json'));
    const missing = missingHumanAttestations(attestations);
    // The partial fixture attests exactly one required human gate, so everything else is missing.
    assert.equal(missing.length, REQUIRED_HUMAN_GATE_IDS.length - 1);
    assert.ok(!missing.includes('published-claims-with-evidence'));
  });
});

test('exitCodeForDecision returns non-zero on NO_GO', () => {
  assert.equal(exitCodeForDecision('GO'), 0);
  assert.equal(exitCodeForDecision('NO_GO'), 1);
});

test('CLI exits non-zero without attestations and zero with all-pass fixture', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'beta-gate-'));
  const outputPath = join(outputDir, 'decision.json');

  // `--output` is REQUIRED on both spawns, not just the second. Without it the CLI writes to its
  // default path — docs/launch/latest-beta-decision.json, the repo's real launch decision — so
  // merely running this test suite overwrote the governance artifact with test output. That is why
  // the committed artifact read `"evaluator": "cli-test"`: it had never been produced by an
  // operator evaluation at all, and commit d6292b7c ("update beta decision evaluator timestamp")
  // is that churn being committed by hand. Found 2026-08-25.
  const noAttest = spawnSync(
    process.execPath,
    [scriptPath, '--evaluator', 'cli-test', '--output', join(outputDir, 'no-attest.json')],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  assert.notEqual(noAttest.status, 0, 'missing attestations must block launch');
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
