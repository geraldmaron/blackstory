/**
 * Machine-checkable evidence probes for launch gates (filesystem + harness smoke).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS } from '../adversarial-integrity/types.js';
import { ALL_LOAD_ABUSE_SCENARIO_IDS } from '../load-abuse/types.js';
import { evaluateCorpus } from '../gold-corpus/metrics.js';
import { loadGoldCorpus, loadGoldPredictions } from '../gold-corpus/load.js';
const PUBLIC_STATIC_MODE_SWITCH_ID = 'public-static-mode';
const BETA_DISABLE_RUNBOOK = 'docs/launch/disable-public-beta.md';

function pathExists(repoRoot: string, relativePath: string): boolean {
  return existsSync(join(repoRoot, relativePath));
}

function readJson(repoRoot: string, relativePath: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as unknown;
}

export type MachineCheckResult =
  { readonly pass: true } | { readonly pass: false; readonly message: string };

export function checkGoldCorpusPrecision(repoRoot: string): MachineCheckResult {
  const corpusPath = 'packages/testing/src/gold-corpus/fixtures/gold-corpus.v1.json';
  const predictionsPath = 'packages/testing/src/gold-corpus/fixtures/predictions.after.v1.json';
  if (!pathExists(repoRoot, corpusPath) || !pathExists(repoRoot, predictionsPath)) {
    return { pass: false, message: 'Gold corpus or after predictions fixture is missing.' };
  }
  const corpus = loadGoldCorpus(join(repoRoot, corpusPath));
  const predictions = loadGoldPredictions(join(repoRoot, predictionsPath));
  const evaluation = evaluateCorpus({
    corpus,
    predictions,
    evaluatedAt: new Date().toISOString(),
  });
  if (!evaluation.passed) {
    return {
      pass: false,
      message: `Gold corpus evaluation failed: ${evaluation.failures.join(', ')}.`,
    };
  }
  return { pass: true };
}

/** A simulated report cannot establish that a backup was restored and inspected. */
export function checkRestoreRehearsal(repoRoot: string): MachineCheckResult {
  const reportPath = 'artifacts/recovery/latest.json';
  if (!pathExists(repoRoot, reportPath)) {
    return { pass: false, message: `Missing executed recovery evidence: ${reportPath}` };
  }
  try {
    const report = readJson(repoRoot, reportPath) as Record<string, unknown>;
    if (
      report.schemaVersion !== 1 ||
      report.mode !== 'executed' ||
      report.database !== 'postgres'
    ) {
      throw new Error('A versioned, executed Postgres restore report is required');
    }
    for (const key of ['backupId', 'sourceId', 'destinationId', 'verifiedBy']) {
      if (typeof report[key] !== 'string' || !String(report[key]).trim()) {
        throw new Error(`Missing ${key}`);
      }
    }
    if (report.sourceId === report.destinationId)
      throw new Error('Restore destination must be isolated');
    const completedAt = Date.parse(String(report.completedAt));
    if (!Number.isFinite(completedAt) || completedAt > Date.now())
      throw new Error('Invalid completion time');
    for (const key of ['elapsedSeconds', 'rtoSeconds', 'dataLossSeconds', 'rpoSeconds']) {
      if (
        typeof report[key] !== 'number' ||
        !Number.isFinite(report[key]) ||
        Number(report[key]) < 0
      ) {
        throw new Error(`Invalid ${key}`);
      }
    }
    if (
      Number(report.rtoSeconds) === 0 ||
      Number(report.elapsedSeconds) > Number(report.rtoSeconds) ||
      Number(report.dataLossSeconds) > Number(report.rpoSeconds)
    )
      throw new Error('Recovery target exceeded');
    const checks = report.checks as Record<string, unknown> | undefined;
    for (const key of [
      'rowCounts',
      'contentHashes',
      'authorization',
      'publicProjection',
      'storageObjects',
    ]) {
      if (checks?.[key] !== true) throw new Error(`Recovery check not verified: ${key}`);
    }
    if (typeof report.logPath !== 'string' || isAbsolute(report.logPath))
      throw new Error('Invalid log path');
    const logPath = resolve(repoRoot, report.logPath);
    if (relative(resolve(repoRoot), logPath).startsWith('..'))
      throw new Error('Log must be inside the evidence root');
    const hash = createHash('sha256').update(readFileSync(logPath)).digest('hex');
    if (hash !== report.logSha256) throw new Error('Recovery log hash mismatch');
    return { pass: true };
  } catch (error) {
    return {
      pass: false,
      message: `Invalid recovery evidence: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function checkLoadAbuseVerified(repoRoot: string): MachineCheckResult {
  const doc = 'docs/testing/load-abuse.md';
  const scenarios = 'packages/testing/src/load-abuse/scenarios.ts';
  if (!pathExists(repoRoot, doc) || !pathExists(repoRoot, scenarios)) {
    return { pass: false, message: 'Load/abuse module or documentation is missing.' };
  }
  if (ALL_LOAD_ABUSE_SCENARIO_IDS.length < 10) {
    return { pass: false, message: 'Load/abuse scenario inventory is incomplete.' };
  }
  return { pass: true };
}

export function checkAdversarialIntegrity(repoRoot: string): MachineCheckResult {
  const doc = 'docs/testing/adversarial-integrity.md';
  const scenarios = 'packages/testing/src/adversarial-integrity/scenarios.ts';
  if (!pathExists(repoRoot, doc) || !pathExists(repoRoot, scenarios)) {
    return { pass: false, message: 'Adversarial integrity module or documentation is missing.' };
  }
  if (ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS.length < 10) {
    return { pass: false, message: 'Adversarial integrity scenario inventory is incomplete.' };
  }
  return { pass: true };
}

export function checkMethodologyCorrections(repoRoot: string): MachineCheckResult {
  const paths = [
    'apps/web/src/app/methodology/page.tsx',
    'apps/web/src/app/corrections/page.tsx',
    'apps/web/src/app/errata/page.tsx',
  ];
  const missing = paths.filter((ref) => !pathExists(repoRoot, ref));
  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing public trust surfaces: ${missing.join(', ')}.`,
    };
  }
  return { pass: true };
}

export function checkDisclaimerFramework(repoRoot: string): MachineCheckResult {
  const registry = 'packages/domain/src/disclaimers.ts';
  const tests = 'packages/domain/src/disclaimers.test.ts';
  if (!pathExists(repoRoot, registry) || !pathExists(repoRoot, tests)) {
    return { pass: false, message: 'Disclaimer registry or tests are missing.' };
  }
  return { pass: true };
}

export function checkReleasePipeline(repoRoot: string): MachineCheckResult {
  const paths = [
    'docs/runbooks/production-release.md',
    'infra/github/release-pipeline/rollback-dry-run.sh',
    'infra/github/release-metadata/deployment-provenance.schema.json',
  ];
  const missing = paths.filter((ref) => !pathExists(repoRoot, ref));
  if (missing.length > 0) {
    return { pass: false, message: `Missing release pipeline evidence: ${missing.join(', ')}.` };
  }
  return { pass: true };
}

export function checkBetaDisablePath(repoRoot: string): MachineCheckResult {
  const killSwitches = join(repoRoot, 'packages/config/src/kill-switches.ts');
  if (!existsSync(killSwitches)) {
    return { pass: false, message: 'Kill switch registry is missing.' };
  }
  const killSwitchSource = readFileSync(killSwitches, 'utf8');
  if (!killSwitchSource.includes(`'${PUBLIC_STATIC_MODE_SWITCH_ID}'`)) {
    return { pass: false, message: 'public-static-mode is not registered in kill switches.' };
  }
  if (!pathExists(repoRoot, BETA_DISABLE_RUNBOOK)) {
    return { pass: false, message: `Missing disable runbook: ${BETA_DISABLE_RUNBOOK}` };
  }
  const runbook = readFileSync(join(repoRoot, BETA_DISABLE_RUNBOOK), 'utf8');
  if (!runbook.includes(PUBLIC_STATIC_MODE_SWITCH_ID) || !/Vercel/i.test(runbook)) {
    return {
      pass: false,
      message: 'Disable runbook must document Vercel host and the static-mode switch.',
    };
  }
  return { pass: true };
}

export function checkEvidencePointersExist(
  repoRoot: string,
  refs: readonly { readonly type: string; readonly ref: string }[],
): MachineCheckResult {
  for (const pointer of refs) {
    if (pointer.type === 'file' || pointer.type === 'artifact') {
      if (!pathExists(repoRoot, pointer.ref)) {
        return { pass: false, message: `Evidence file missing: ${pointer.ref}` };
      }
    }
    if (pointer.type === 'doc') {
      if (!pathExists(repoRoot, pointer.ref)) {
        return { pass: false, message: `Evidence doc missing: ${pointer.ref}` };
      }
    }
  }
  return { pass: true };
}

const MACHINE_CHECKS: Readonly<Record<string, (repoRoot: string) => MachineCheckResult>> = {
  'gold-corpus-precision': checkGoldCorpusPrecision,
  'restore-rehearsal-complete': checkRestoreRehearsal,
  'load-abuse-verified': checkLoadAbuseVerified,
  'adversarial-integrity-verified': checkAdversarialIntegrity,
  'methodology-corrections-available': checkMethodologyCorrections,
  'disclaimer-framework-live': checkDisclaimerFramework,
  'release-pipeline-ready': checkReleasePipeline,
  'beta-disable-path-ready': checkBetaDisablePath,
};

export function runMachineGateCheck(gateId: string, repoRoot: string): MachineCheckResult {
  const checker = MACHINE_CHECKS[gateId];
  if (checker === undefined) {
    return { pass: false, message: `No machine checker registered for ${gateId}.` };
  }
  return checker(repoRoot);
}
