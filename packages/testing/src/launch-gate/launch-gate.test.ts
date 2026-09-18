/**
 * beta launch gate tests fail-closed human attestations and non-zero exit on NO_GO.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it, test } from 'node:test';
import { checkRestoreRehearsal } from './evidence-checks.js';
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

// Unit fixtures live outside the repository and never attest its operational readiness.
const fixtureRoot = mkdtempSync(join(tmpdir(), 'launch-evidence-'));
after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
for (const ref of new Set([
  ...BETA_LAUNCH_GATES.flatMap((gate) => gate.evidence.map((item) => item.ref)),
  'packages/config/src/kill-switches.ts',
])) {
  if (existsSync(join(repoRoot, ref))) {
    mkdirSync(dirname(join(fixtureRoot, ref)), { recursive: true });
    cpSync(join(repoRoot, ref), join(fixtureRoot, ref), { recursive: true });
  }
}
const log = 'Controlled recovery verification fixture. Not an executed restore.';
const recoveryReport = {
  schemaVersion: 1,
  mode: 'executed',
  database: 'postgres',
  backupId: 'fixture-backup',
  sourceId: 'fixture-source',
  destinationId: 'fixture-isolated',
  verifiedBy: 'fixture-reviewer',
  completedAt: '2026-07-01T00:00:00Z',
  elapsedSeconds: 2,
  rtoSeconds: 60,
  dataLossSeconds: 0,
  rpoSeconds: 0,
  checks: {
    rowCounts: true,
    contentHashes: true,
    authorization: true,
    publicProjection: true,
    storageObjects: true,
  },
  logPath: 'artifacts/recovery/fixture.log',
  logSha256: createHash('sha256').update(log).digest('hex'),
};
mkdirSync(join(fixtureRoot, 'artifacts/recovery'), { recursive: true });
writeFileSync(join(fixtureRoot, recoveryReport.logPath), log);
writeFileSync(join(fixtureRoot, 'artifacts/recovery/latest.json'), JSON.stringify(recoveryReport));

describe('evaluateBetaLaunchGate', () => {
  it('returns NO_GO when required human attestations are missing (fail-closed)', () => {
    const report = evaluateBetaLaunchGate({
      repoRoot: fixtureRoot,
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
      repoRoot: fixtureRoot,
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

  const signedWith = (attestedBy: string, attestedAt: string) => ({
    schemaVersion: 1 as const,
    attestations: REQUIRED_HUMAN_GATE_IDS.map((gateId) => ({ gateId, attestedBy, attestedAt })),
  });

  const decisionFor = (attestations: ReturnType<typeof signedWith>) =>
    evaluateBetaLaunchGate({
      repoRoot: fixtureRoot,
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

test('CLI cannot claim readiness from a human fixture without recovery evidence', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'beta-gate-'));
  const outputPath = join(outputDir, 'decision.json');

  // CLI tests always write outside the repository and use its actual readiness state.
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
  assert.notEqual(allPass.status, 0, 'human attestations cannot replace missing recovery evidence');
  const artifact = JSON.parse(readFileSync(outputPath, 'utf8')) as { decision: string };
  assert.equal(artifact.decision, 'NO_GO');
});

test('recovery gate rejects simulations, target breaches, failed checks, and changed logs', () => {
  const root = mkdtempSync(join(tmpdir(), 'recovery-evidence-'));
  try {
    mkdirSync(join(root, 'artifacts/recovery'), { recursive: true });
    writeFileSync(join(root, recoveryReport.logPath), log);
    assert.equal(checkRestoreRehearsal(root).pass, false);
    for (const patch of [
      { mode: 'dry-run' },
      { elapsedSeconds: 61 },
      { dataLossSeconds: 1 },
      { sourceId: 'fixture-isolated' },
      { checks: { ...recoveryReport.checks, authorization: false } },
      { logSha256: 'incorrect' },
      { logPath: '../outside.log' },
      { completedAt: 'invalid' },
    ]) {
      writeFileSync(
        join(root, 'artifacts/recovery/latest.json'),
        JSON.stringify({ ...recoveryReport, ...patch }),
      );
      assert.equal(checkRestoreRehearsal(root).pass, false, JSON.stringify(patch));
    }
    writeFileSync(join(root, 'artifacts/recovery/latest.json'), JSON.stringify(recoveryReport));
    assert.equal(checkRestoreRehearsal(root).pass, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
