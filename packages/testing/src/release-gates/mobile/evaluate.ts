/**
 * Fail-closed evaluator for the mobile store release gate.
 *
 * Same decision rule as the beta launch gate: any required gate failing is NO_GO. Human
 * attestations are validated by the launch gate's own validator rather than a second copy of it,
 * so a placeholder signature or an impossible date is refused identically on both paths.
 */
import { humanAttestationDefect } from '../../launch-gate/evaluate.js';
import type { HumanAttestationRecord } from '../../launch-gate/types.js';
import { MOBILE_RELEASE_GATES, REQUIRED_HUMAN_RELEASE_GATE_IDS } from './criteria.js';
import { runMobileReleaseCheck } from './checks.js';
import type {
  HumanAttestationBundle,
  LaunchDecision,
  LaunchGateResult,
  MobileReleaseDecisionReport,
  MobileReleaseEvaluationInput,
  MobileReleaseEvidence,
} from './types.js';
import { MOBILE_RELEASE_DECISION_SCHEMA_VERSION } from './types.js';

function attestationFor(
  bundle: HumanAttestationBundle | undefined,
  gateId: string,
): HumanAttestationRecord | undefined {
  return bundle?.attestations.find((record) => record.gateId === gateId);
}

function evaluateHumanGate(
  definition: (typeof MOBILE_RELEASE_GATES)[number],
  bundle: HumanAttestationBundle | undefined,
  evaluatedAtMs: number,
): LaunchGateResult {
  const base = {
    id: definition.id,
    title: definition.title,
    kind: 'human' as const,
    required: definition.required,
    evidence: definition.evidence,
  };
  const record = attestationFor(bundle, definition.id);
  if (record === undefined) {
    return {
      ...base,
      status: 'fail',
      message: 'Human attestation missing — fail-closed until recorded.',
    };
  }
  const defect = humanAttestationDefect(record, evaluatedAtMs);
  if (defect !== undefined) {
    return { ...base, status: 'fail', message: `Human attestation invalid: ${defect}.` };
  }
  return {
    ...base,
    status: 'pass',
    message: `Attested by ${record.attestedBy} at ${record.attestedAt}.`,
  };
}

function evaluateMachineGate(
  definition: (typeof MOBILE_RELEASE_GATES)[number],
  evidence: MobileReleaseEvidence,
): LaunchGateResult {
  const result = runMobileReleaseCheck(definition.id, evidence);
  return {
    id: definition.id,
    title: definition.title,
    kind: 'machine',
    required: definition.required,
    status: result.pass ? 'pass' : 'fail',
    message: result.pass ? 'Verified from the collected artifacts.' : result.message,
    evidence: definition.evidence,
  };
}

function summarizeDecision(gates: readonly LaunchGateResult[]): LaunchDecision {
  return gates.some((gate) => gate.required && gate.status === 'fail') ? 'NO_GO' : 'GO';
}

/** Returns gate ids that require human attestation but are not present in the bundle. */
export function missingReleaseAttestations(
  bundle: HumanAttestationBundle | undefined,
): readonly string[] {
  return REQUIRED_HUMAN_RELEASE_GATE_IDS.filter(
    (gateId) => attestationFor(bundle, gateId) === undefined,
  );
}

/** Evaluates every mobile release gate against one evidence bundle. */
export function evaluateMobileReleaseGate(
  input: MobileReleaseEvaluationInput,
): MobileReleaseDecisionReport {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const evaluatedAtMs = Date.parse(evaluatedAt);
  const gates = MOBILE_RELEASE_GATES.map((definition) =>
    definition.kind === 'human'
      ? evaluateHumanGate(definition, input.attestations, evaluatedAtMs)
      : evaluateMachineGate(definition, input.evidence),
  );

  return {
    schemaVersion: MOBILE_RELEASE_DECISION_SCHEMA_VERSION,
    evaluator: input.evaluator,
    evaluatedAt,
    variant: input.evidence.variant,
    commitSha: input.evidence.commit.sha,
    decision: summarizeDecision(gates),
    requiredPassed: gates.filter((gate) => gate.required && gate.status === 'pass').length,
    requiredFailed: gates.filter((gate) => gate.required && gate.status === 'fail').length,
    optionalFailed: gates.filter((gate) => !gate.required && gate.status === 'fail').length,
    gates,
  };
}

/** Throws when the decision is NO_GO, for programmatic fail-closed callers. */
export function assertMobileReleaseGo(report: MobileReleaseDecisionReport): void {
  if (report.decision !== 'GO') {
    const failed = report.gates
      .filter((gate) => gate.required && gate.status === 'fail')
      .map((gate) => gate.id);
    throw new Error(`Mobile release gate NO_GO: ${failed.join(', ')}`);
  }
}
