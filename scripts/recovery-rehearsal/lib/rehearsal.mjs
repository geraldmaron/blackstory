/**
 * Core recovery rehearsal logic. Simulates procedure timing from fixtures,
 * validates break-glass paths, and aggregates measured recovery times no live GCP calls.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyActiveReleasePointer,
  verifyExportMetadata,
  verifyManifestEnvelope,
} from '../../backup-restore/lib/verification.mjs';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '../..');

export const DEFAULT_PATHS = {
  scenario: path.join(SCRIPT_ROOT, 'fixtures/rehearsal-scenario.json'),
  checklist: path.join(REPO_ROOT, 'infra/gcp/recovery-rehearsal/checklist.json'),
  timingMatrix: path.join(REPO_ROOT, 'infra/gcp/recovery-rehearsal/timing-matrix.json'),
  breakGlass: path.join(REPO_ROOT, 'infra/gcp/recovery-rehearsal/break-glass-matrix.json'),
};

export async function readJson(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(REPO_ROOT, filePath);
  return JSON.parse(await readFile(resolved, 'utf8'));
}

export function resolveFixturePath(relativePath, baseDir = SCRIPT_ROOT) {
  return path.resolve(baseDir, relativePath);
}

export function getProcedureSteps(checklist, stepFilter = null) {
  const steps = [...checklist.orderedSteps].sort((a, b) => a.order - b.order);
  if (!stepFilter) {
    return steps;
  }
  const match = steps.find((s) => s.id === stepFilter);
  if (!match) {
    throw new Error(`Unknown rehearsal step: ${stepFilter}`);
  }
  return [match];
}

export function assertBreakGlassPath(step, scenario, breakGlassMatrix) {
  const errors = [];
  const compromised = new Set([
    scenario.compromisedIdentity,
    ...(breakGlassMatrix.compromisedIdentityExamples ?? []),
  ]);

  if (step.mustNotUse && !compromised.has(step.mustNotUse)) {
    errors.push(`Step ${step.id}: mustNotUse ${step.mustNotUse} not in compromised set`);
  }

  const identity = step.breakGlassIdentity;
  const allowed = (breakGlassMatrix.breakGlassPaths ?? []).some((p) => p.id === identity);
  if (!allowed) {
    errors.push(`Step ${step.id} breakGlassIdentity "${identity}" not in break-glass matrix`);
  }

  if (identity === 'github-deploy' || compromised.has(identity)) {
    errors.push(`Step ${step.id} must not use compromised identity for recovery`);
  }

  return { ok: errors.length === 0, errors };
}

export async function verifyDatabaseRestore(scenario) {
  const metadata = await readJson(resolveFixturePath(scenario.metadataFixture));
  const baselineCounts = await readJson(resolveFixturePath(scenario.baselineCountsFixture));
  const baselineHashes = await readJson(resolveFixturePath(scenario.baselineHashesFixture));
  const result = verifyExportMetadata(metadata, { baselineCounts, baselineHashes });
  return {
    ok: result.ok,
    errors: result.errors,
    dryRunNote: `Would import ${scenario.exportUri} into ${scenario.stagingProject} via backup@ (human gcloud)`,
  };
}

export async function verifyActiveReleaseRollback(scenario) {
  const priorRelease = await readJson(resolveFixturePath(scenario.priorReleaseFixture));
  const priorPointer = await readJson(resolveFixturePath('fixtures/prior-active-pointer.json'));
  const envelope = verifyManifestEnvelope(priorRelease.signedManifest);
  const pointer = verifyActiveReleasePointer(priorPointer, priorRelease);
  const ok = envelope.ok && pointer.ok && priorRelease.releaseId === scenario.priorReleaseId;
  return {
    ok,
    errors: [...envelope.errors, ...pointer.errors],
    dryRunNote: `Would roll back from ${scenario.badReleaseId} to ${scenario.priorReleaseId}`,
  };
}

export function verifyRevokeDeployIdentity(scenario, breakGlassMatrix) {
  const compromised = scenario.compromisedIdentity;
  const pathUsesCompromised = (breakGlassMatrix.breakGlassPaths ?? []).some(
    (p) => p.email === compromised || p.id === 'github-deploy',
  );
  const ok = compromised.includes('github-deploy') && !pathUsesCompromised;
  return {
    ok,
    errors: ok ? [] : ['Revoke path must not depend on compromised deploy SA'],
    dryRunNote: `Would disable WIF pool binding and disable SA: ${compromised}`,
  };
}

export function verifyRotateSecrets() {
  return {
    ok: true,
    errors: [],
    dryRunNote: 'Would disable Secret Manager versions via 1Password op:// refs; no values logged',
  };
}

export function verifyPauseQueues(scenario) {
  const queues = scenario.queues ?? [];
  const ok = queues.length > 0 && queues.every((q) => q.depth >= 0);
  return {
    ok,
    errors: ok ? [] : ['Queue fixture missing depth/age snapshot'],
    dryRunNote: `Would pause ${queues.map((q) => q.id).join(', ')} without purge`,
  };
}

export function verifyDisableSubmissions() {
  return {
    ok: true,
    errors: [],
    dryRunNote: 'Would engage corrections-submissions kill switch + optional Armor scoped deny',
  };
}

export function verifyBlockTraffic() {
  return {
    ok: true,
    errors: [],
    dryRunNote: 'Would set Cloud Armor rule 10 to deny-403 on both API policies (BB-023)',
  };
}

export function verifyRebuildProjections(scenario) {
  const ok = Boolean(scenario.priorReleaseId);
  return {
    ok,
    errors: ok ? [] : ['Missing prior release for projection rebuild'],
    dryRunNote: `Would replay publication worker for release ${scenario.priorReleaseId}`,
  };
}

export function verifyRestorePublicObject(scenario) {
  const obj = scenario.publicObject;
  const ok = Boolean(obj?.bucket && obj?.restoreGeneration);
  return {
    ok,
    errors: ok ? [] : ['Missing public object restore fixture'],
    dryRunNote: `Would restore gs://${obj.bucket}/${obj.objectPath} generation ${obj.restoreGeneration}`,
  };
}

export function verifyDeclareAndIsolate() {
  return {
    ok: true,
    errors: [],
    dryRunNote: 'Would open incident, assign roles, engage publication + volume switches',
  };
}

export function verifyRecordFindings() {
  return {
    ok: true,
    errors: [],
    dryRunNote: 'Would write findings from infra/gcp/recovery-rehearsal/findings-template.md',
  };
}

const VERIFIERS = {
  'declare-and-isolate': verifyDeclareAndIsolate,
  'block-malicious-traffic': verifyBlockTraffic,
  'disable-submissions': verifyDisableSubmissions,
  'pause-queues': verifyPauseQueues,
  'revoke-compromised-deploy-identity': verifyRevokeDeployIdentity,
  'rotate-secrets': verifyRotateSecrets,
  'active-release-rollback': verifyActiveReleaseRollback,
  'database-restore': verifyDatabaseRestore,
  'rebuild-public-projections': verifyRebuildProjections,
  'restore-deleted-public-object': verifyRestorePublicObject,
  'record-findings': verifyRecordFindings,
};

export async function verifyStep(step, scenario, breakGlassMatrix) {
  const breakGlass = assertBreakGlassPath(step, scenario, breakGlassMatrix);
  const verifier = VERIFIERS[step.id];
  if (!verifier) {
    return { ok: false, errors: [`No verifier for step ${step.id}`], breakGlass };
  }

  let result;
  if (step.id === 'revoke-compromised-deploy-identity') {
    result = verifyRevokeDeployIdentity(scenario, breakGlassMatrix);
  } else if (step.id === 'pause-queues') {
    result = verifyPauseQueues(scenario);
  } else if (step.id === 'rebuild-public-projections') {
    result = verifyRebuildProjections(scenario);
  } else if (step.id === 'restore-deleted-public-object') {
    result = verifyRestorePublicObject(scenario);
  } else if (step.id === 'active-release-rollback') {
    result = await verifyActiveReleaseRollback(scenario);
  } else if (step.id === 'database-restore') {
    result = await verifyDatabaseRestore(scenario);
  } else {
    result = verifier();
  }

  const ok = breakGlass.ok && result.ok;
  return {
    stepId: step.id,
    ok,
    errors: [...breakGlass.errors, ...result.errors],
    dryRunNote: result.dryRunNote,
    breakGlassIdentity: step.breakGlassIdentity,
    rtoTargetMinutes: step.rtoTargetMinutes,
  };
}

export function simulateDuration(stepId, scenario) {
  return scenario.simulatedDurationsMs?.[stepId] ?? 60000;
}

export function buildTimingReport(steps, scenario, timingMatrix, startedAtMs) {
  let cursor = startedAtMs;
  const procedures = steps.map((step) => {
    const durationMs = simulateDuration(step.id, scenario);
    const startedAt = new Date(cursor).toISOString();
    cursor += durationMs;
    const completedAt = new Date(cursor).toISOString();
    const measuredMinutes = Math.round((durationMs / 60000) * 10) / 10;
    const target = timingMatrix.targets?.[step.id] ?? {};
    const rtoTargetMinutes = step.rtoTargetMinutes ?? target.rtoMinutes ?? null;
    const withinRto = rtoTargetMinutes == null ? true : measuredMinutes <= rtoTargetMinutes;

    return {
      stepId: step.id,
      order: step.order,
      label: step.label,
      breakGlassIdentity: step.breakGlassIdentity,
      rtoTargetMinutes,
      measuredMinutes,
      withinRto,
      startedAt,
      completedAt,
      durationMs,
    };
  });

  const totalMeasuredMinutes = procedures.reduce((sum, p) => sum + p.measuredMinutes, 0);

  return {
    schemaVersion: 1,
    bead: 'BB-061',
    scenarioId: scenario.scenarioId,
    mode: 'dry-run',
    compromisedIdentity: scenario.compromisedIdentity,
    breakGlassIdentity: scenario.breakGlassIdentity,
    recordedAt: new Date(startedAtMs).toISOString(),
    totalMeasuredMinutes,
    allWithinRto: procedures.every((p) => p.withinRto),
    procedures,
  };
}

export function validateTimingReport(report) {
  const errors = [];
  if (!report.procedures?.length) {
    errors.push('Report has no procedures');
  }
  for (const proc of report.procedures ?? []) {
    if (proc.measuredMinutes <= 0) {
      errors.push(`${proc.stepId}: measured time must be positive`);
    }
    if (proc.breakGlassIdentity?.includes('github-deploy')) {
      errors.push(`${proc.stepId}: used compromised identity`);
    }
  }
  return { ok: errors.length === 0, errors };
}
