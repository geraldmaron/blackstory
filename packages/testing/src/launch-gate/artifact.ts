
/**
 * JSON decision artifact schema validation and writer for launch records.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BetaLaunchEvaluationReport, HumanAttestationBundle } from './types.js';
import { BETA_LAUNCH_DECISION_SCHEMA_VERSION } from './types.js';

const GATE_RESULT_REQUIRED = ['id', 'title', 'kind', 'required', 'status', 'message', 'evidence'] as const;
const EVIDENCE_REQUIRED = ['type', 'ref'] as const;

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function assertEvidenceArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  for (const [index, entry] of value.entries()) {
    const record = assertRecord(entry, `${label}[${index}]`);
    for (const key of EVIDENCE_REQUIRED) {
      assertString(record[key], `${label}[${index}].${key}`);
    }
  }
}

function assertGateResult(value: unknown, index: number): void {
  const record = assertRecord(value, `gates[${index}]`);
  for (const key of GATE_RESULT_REQUIRED) {
    if (key === 'evidence') {
      assertEvidenceArray(record[key], `gates[${index}].evidence`);
      continue;
    }
    if (key === 'required') {
      assertBoolean(record[key], `gates[${index}].required`);
      continue;
    }
    assertString(record[key], `gates[${index}].${key}`);
  }
  const status = assertString(record.status, `gates[${index}].status`);
  if (status !== 'pass' && status !== 'fail' && status !== 'skipped') {
    throw new Error(`gates[${index}].status is invalid.`);
  }
}

/** Validates the launch decision artifact shape (fail-closed on malformed records). */
export function validateBetaLaunchDecisionArtifact(value: unknown): BetaLaunchEvaluationReport {
  const record = assertRecord(value, 'artifact');
  if (record.schemaVersion !== BETA_LAUNCH_DECISION_SCHEMA_VERSION) {
    throw new Error('artifact.schemaVersion must be 1.');
  }
  if (record.bead !== '') {
    throw new Error('artifact.bead must be .');
  }
  assertString(record.evaluator, 'artifact.evaluator');
  assertString(record.evaluatedAt, 'artifact.evaluatedAt');
  const decision = assertString(record.decision, 'artifact.decision');
  if (decision !== 'GO' && decision !== 'NO_GO') {
    throw new Error('artifact.decision must be GO or NO_GO.');
  }
  if (!Array.isArray(record.gates)) {
    throw new Error('artifact.gates must be an array.');
  }
  record.gates.forEach((gate, index) => assertGateResult(gate, index));
  return value as BetaLaunchEvaluationReport;
}

export function loadHumanAttestationBundle(path: string): HumanAttestationBundle {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const record = assertRecord(parsed, 'attestations');
  if (record.schemaVersion !== 1) {
    throw new Error('attestations.schemaVersion must be 1.');
  }
  if (!Array.isArray(record.attestations)) {
    throw new Error('attestations.attestations must be an array.');
  }
  for (const [index, entry] of record.attestations.entries()) {
    const att = assertRecord(entry, `attestations[${index}]`);
    assertString(att.gateId, `attestations[${index}].gateId`);
    assertString(att.attestedBy, `attestations[${index}].attestedBy`);
    assertString(att.attestedAt, `attestations[${index}].attestedAt`);
  }
  return parsed as HumanAttestationBundle;
}

export function writeBetaLaunchDecisionArtifact(
  outputPath: string,
  report: BetaLaunchEvaluationReport,
): void {
  validateBetaLaunchDecisionArtifact(report);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
