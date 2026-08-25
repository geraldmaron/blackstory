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

  // Regression: a bundle signed "TODO" six times produced a full GO with exit code 0 until
  // 2026-08-25. Empty was rejected at load, but anything non-empty passed the gate, so there was
  // no state that both loaded and read as unsigned.
  const signedWith = (attestedBy: string, attestedAt: string) => ({
    schemaVersion: 1 as const,
    attestations: REQUIRED_HUMAN_GATE_IDS.map((gateId) => ({ gateId, attestedBy, attestedAt })),
  });

  const decisionFor = (attestations: ReturnType<typeof signedWith>) =>
    evaluateBetaLaunchGate({
      repoRoot,
      evaluator: 'test-harness',
      evaluatedAt: '2026-08-25T00:00:00.000Z',
      attestations,
    });

  it('rejects placeholder signatures instead of attesting every gate', () => {
    for (const placeholder of ['TODO', 'todo', 'tbd', 'pending', 'n/a', 'x', 'FIXME']) {
      const report = decisionFor(signedWith(placeholder, '2026-08-24T00:00:00.000Z'));
      assert.equal(report.decision, 'NO_GO', `"${placeholder}" must not attest a gate`);
      assert.equal(report.requiredFailed, REQUIRED_HUMAN_GATE_IDS.length);
    }
  });

  it('rejects an attestedAt that is not a real date', () => {
    // The likeliest improvised placeholder is one that is not a date at all.
    const report = decisionFor(signedWith('gerald', 'TODO'));
    assert.equal(report.decision, 'NO_GO');
    assert.equal(report.requiredFailed, REQUIRED_HUMAN_GATE_IDS.length);
  });

  it('rejects an attestedAt in the future', () => {
    // A review cannot have happened yet. Also catches a copy-pasted far-future timestamp.
    const report = decisionFor(signedWith('gerald', '2027-01-01T00:00:00.000Z'));
    assert.equal(report.decision, 'NO_GO');
    assert.equal(report.requiredFailed, REQUIRED_HUMAN_GATE_IDS.length);
  });

  it('accepts a real identity with a real past date', () => {
    const report = decisionFor(signedWith('gerald@example.com', '2026-08-24T12:00:00.000Z'));
    assert.equal(report.requiredFailed, 0);
    assert.equal(report.decision, 'GO');
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
