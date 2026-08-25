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

/**
 * Signatures that are obviously not a person.
 *
 * WHY THIS EXISTS. `artifact.ts` rejects an empty `attestedBy` at load, but this module only
 * checked `.trim()` — so ANY non-empty string passed, and a bundle signed `TODO` six times
 * produced a full GO with exit code 0. There was no state that both loaded successfully and read
 * as unsigned, which meant the natural way to fill in the scaffold (drop TODO in the blanks, come
 * back later) silently attested every gate, including living-addresses-zero. Demonstrated and
 * fixed 2026-08-25.
 *
 * The denylist is the weaker half of the fix and is not meant to be exhaustive — `attestedAt`
 * having to be a real, non-future date is what actually stops improvised placeholders, since
 * almost nothing a person types absent-mindedly parses as a date.
 */
const PLACEHOLDER_SIGNATURES: ReadonlySet<string> = new Set([
  '-',
  '?',
  'change-me',
  'changeme',
  'fixme',
  'n/a',
  'na',
  'none',
  'placeholder',
  'pending',
  'tba',
  'tbd',
  'todo',
  'unknown',
  'x',
  'xxx',
]);

/** Date-only or full ISO-8601. Rejects sloppiness like a bare year that `Date.parse` accepts. */
const ISO_8601 = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Returns why an attestation is not usable, or undefined when it is.
 *
 * Deliberately NOT checking staleness (an attestation older than N days). That is a policy call
 * about how long a human review stays valid, and it belongs to whoever sets the release cadence —
 * not smuggled in behind a placeholder fix. Note the shipped fixture attests at 2026-07-17, so a
 * staleness rule would need that fixture regenerated rather than a constant nudged.
 */
function attestationDefect(
  record: HumanAttestationRecord,
  evaluatedAtMs: number,
): string | undefined {
  const by = record.attestedBy.trim();
  const at = record.attestedAt.trim();
  if (!by || !at) {
    return 'attestedBy/attestedAt required';
  }
  if (PLACEHOLDER_SIGNATURES.has(by.toLowerCase())) {
    return `attestedBy is a placeholder ("${by}") — a gate cannot be attested by nobody`;
  }
  if (!ISO_8601.test(at)) {
    return `attestedAt must be an ISO-8601 date, got "${at}"`;
  }
  const attestedAtMs = Date.parse(at);
  if (!Number.isFinite(attestedAtMs)) {
    return `attestedAt is not a real date, got "${at}"`;
  }
  if (attestedAtMs > evaluatedAtMs) {
    return `attestedAt is in the future ("${at}") — a review cannot have happened yet`;
  }
  return undefined;
}

function evaluateHumanGate(
  gateId: string,
  title: string,
  required: boolean,
  bundle: HumanAttestationBundle | undefined,
  evidence: LaunchGateResult['evidence'],
  evaluatedAtMs: number,
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
  const defect = attestationDefect(record, evaluatedAtMs);
  if (defect !== undefined) {
    return {
      id: gateId,
      title,
      kind: 'human',
      required,
      status: 'fail',
      message: `Human attestation invalid: ${defect}.`,
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
  const evaluatedAtMs = Date.parse(evaluatedAt);
  const gates = BETA_LAUNCH_GATES.map((definition) => {
    if (definition.kind === 'human') {
      return evaluateHumanGate(
        definition.id,
        definition.title,
        definition.required,
        input.attestations,
        definition.evidence,
        evaluatedAtMs,
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
    bead: '',
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
