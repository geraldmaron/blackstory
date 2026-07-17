
/**
 * Fail-closed beta launch gate evaluator aggregates machine checks and human attestations.
 */
import { BETA_LAUNCH_GATES, REQUIRED_HUMAN_GATE_IDS } from './criteria.js';
import { checkEvidencePointersExist, runMachineGateCheck } from './evidence-checks.js';
import type {
  BetaLaunchEvaluationInput,
  BetaLaunchEvaluationReport,
  HumanAttestationBundle,
  HumanAttestationRecord,
  LaunchDecision,
  LaunchGateResult,
} from './types.js';
import { BETA_LAUNCH_DECISION_SCHEMA_VERSION } from './types.js';

function attestationFor(
  bundle: HumanAttestationBundle | undefined,
  gateId: string,
): HumanAttestationRecord | undefined {
  return bundle?.attestations.find((record) => record.gateId === gateId);
}

function evaluateHumanGate(
  gateId: string,
  title: string,
  required: boolean,
  bundle: HumanAttestationBundle | undefined,
  evidence: LaunchGateResult['evidence'],
): LaunchGateResult {
  const record = attestationFor(bundle, gateId);
  if (record === undefined) {
    return {
      id: gateId,
      title,
      kind: 'human',
      required,
      status: 'fail',
      message: 'Human attestation missing — fail-closed until recorded.',
      evidence,
    };
  }
  if (!record.attestedBy.trim() || !record.attestedAt.trim()) {
    return {
      id: gateId,
      title,
      kind: 'human',
      required,
      status: 'fail',
      message: 'Human attestation incomplete (attestedBy/attestedAt required).',
      evidence,
    };
  }
  return {
    id: gateId,
    title,
    kind: 'human',
    required,
    status: 'pass',
    message: `Attested by ${record.attestedBy} at ${record.attestedAt}.`,
    evidence,
  };
}

function evaluateMachineGate(
  gateId: string,
  title: string,
  required: boolean,
  repoRoot: string,
  evidence: LaunchGateResult['evidence'],
): LaunchGateResult {
  const pointerCheck = checkEvidencePointersExist(repoRoot, evidence);
  if (!pointerCheck.pass) {
    return {
      id: gateId,
      title,
      kind: 'machine',
      required,
      status: 'fail',
      message: pointerCheck.message,
      evidence,
    };
  }
  const result = runMachineGateCheck(gateId, repoRoot);
  return {
    id: gateId,
    title,
    kind: 'machine',
    required,
    status: result.pass ? 'pass' : 'fail',
    message: result.pass ? 'Machine evidence checks passed.' : result.message,
    evidence,
  };
}

function summarizeDecision(gates: readonly LaunchGateResult[]): LaunchDecision {
  const requiredFailures = gates.filter((gate) => gate.required && gate.status === 'fail');
  return requiredFailures.length === 0 ? 'GO' : 'NO_GO';
}

/** Returns gate ids that require human attestation but are not present in the bundle. */
export function missingHumanAttestations(
  bundle: HumanAttestationBundle | undefined,
): readonly string[] {
  return REQUIRED_HUMAN_GATE_IDS.filter((gateId) => attestationFor(bundle, gateId) === undefined);
}

/** Evaluates all launch gates; required failures yield NO_GO. */
export function evaluateBetaLaunchGate(
  input: BetaLaunchEvaluationInput,
): BetaLaunchEvaluationReport {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const gates = BETA_LAUNCH_GATES.map((definition) => {
    if (definition.kind === 'human') {
      return evaluateHumanGate(
        definition.id,
        definition.title,
        definition.required,
        input.attestations,
        definition.evidence,
      );
    }
    return evaluateMachineGate(
      definition.id,
      definition.title,
      definition.required,
      input.repoRoot,
      definition.evidence,
    );
  });

  const requiredFailed = gates.filter((gate) => gate.required && gate.status === 'fail').length;
  const requiredPassed = gates.filter((gate) => gate.required && gate.status === 'pass').length;
  const optionalFailed = gates.filter((gate) => !gate.required && gate.status === 'fail').length;

  return {
    schemaVersion: BETA_LAUNCH_DECISION_SCHEMA_VERSION,
    bead: 'BB-063',
    evaluator: input.evaluator,
    evaluatedAt,
    decision: summarizeDecision(gates),
    requiredFailed,
    requiredPassed,
    optionalFailed,
    gates,
  };
}

/** Throws when decision is NO_GO for programmatic fail-closed callers. */
export function assertBetaLaunchGo(report: BetaLaunchEvaluationReport): void {
  if (report.decision !== 'GO') {
    const failed = report.gates
      .filter((gate) => gate.required && gate.status === 'fail')
      .map((gate) => gate.id);
    throw new Error(`Beta launch gate NO_GO: ${failed.join(', ')}`);
  }
}

export function exitCodeForDecision(decision: LaunchDecision): number {
  return decision === 'GO' ? 0 : 1;
}
