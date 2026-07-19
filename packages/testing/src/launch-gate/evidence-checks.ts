
/**
 * Machine-checkable evidence probes for launch gates (filesystem + harness smoke).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS } from '../adversarial-integrity/types.js';
import { ALL_LOAD_ABUSE_SCENARIO_IDS } from '../load-abuse/types.js';
import { evaluateCorpus } from '../gold-corpus/metrics.js';
import { loadGoldCorpus, loadGoldPredictions } from '../gold-corpus/load.js';
const PUBLIC_READ_API_DISABLED_ENV = 'PUBLIC_READ_API_DISABLED';
const PUBLIC_STATIC_MODE_SWITCH_ID = 'public-static-mode';
const BETA_DISABLE_RUNBOOK = 'docs/launch/disable-public-beta.md';
const APP_HOSTING_FILES = [
  'apps/web/apphosting.yaml',
  'apps/web/apphosting.production.yaml',
  'apps/web/apphosting.staging.yaml',
] as const;

function pathExists(repoRoot: string, relativePath: string): boolean {
  return existsSync(join(repoRoot, relativePath));
}

function readJson(repoRoot: string, relativePath: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as unknown;
}

export type MachineCheckResult = { readonly pass: true } | { readonly pass: false; readonly message: string };

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

export function checkRestoreRehearsal(repoRoot: string): MachineCheckResult {
  const runner = 'scripts/recovery-rehearsal/run-rehearsal.mjs';
  const reportPath = 'scripts/recovery-rehearsal/fixtures/last-rehearsal-report.json';
  const rollback = 'infra/github/release-pipeline/rollback-dry-run.sh';
  for (const ref of [runner, reportPath, rollback]) {
    if (!pathExists(repoRoot, ref)) {
      return { pass: false, message: `Missing restore rehearsal evidence: ${ref}` };
    }
  }
  const report = readJson(repoRoot, reportPath) as {
    allWithinRto?: boolean;
    mode?: string;
  };
  if (report.mode !== 'dry-run') {
    return { pass: false, message: 'Last rehearsal report is not marked dry-run.' };
  }
  if (report.allWithinRto !== true) {
    return { pass: false, message: 'Last rehearsal report indicates RTO breach.' };
  }
  return { pass: true };
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
  for (const file of APP_HOSTING_FILES) {
    if (!pathExists(repoRoot, file)) {
      return { pass: false, message: `Missing App Hosting config: ${file}` };
    }
    const content = readFileSync(join(repoRoot, file), 'utf8');
    if (!content.includes(`variable: ${PUBLIC_READ_API_DISABLED_ENV}`)) {
      return { pass: false, message: `${file} does not declare ${PUBLIC_READ_API_DISABLED_ENV}.` };
    }
  }
  if (!pathExists(repoRoot, BETA_DISABLE_RUNBOOK)) {
    return { pass: false, message: `Missing disable runbook: ${BETA_DISABLE_RUNBOOK}` };
  }
  const runbook = readFileSync(join(repoRoot, BETA_DISABLE_RUNBOOK), 'utf8');
  if (!runbook.includes(PUBLIC_READ_API_DISABLED_ENV) || !runbook.includes(PUBLIC_STATIC_MODE_SWITCH_ID)) {
    return { pass: false, message: 'Disable runbook must document env flag and static-mode switch.' };
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

const MACHINE_CHECKS: Readonly<
  Record<string, (repoRoot: string) => MachineCheckResult>
> = {
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
