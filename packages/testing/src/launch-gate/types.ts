
/**
 * Contracts for beta launch gate evaluation, attestation, and recorded decisions.
 */

export const BETA_LAUNCH_DECISION_SCHEMA_VERSION = 1 as const;

export type LaunchGateKind = 'machine' | 'human';

export type LaunchGateStatus = 'pass' | 'fail' | 'skipped';

export type LaunchDecision = 'GO' | 'NO_GO';

export type EvidencePointerType = 'file' | 'doc' | 'command' | 'artifact';

export interface EvidencePointer {
  readonly type: EvidencePointerType;
  readonly ref: string;
  readonly description?: string;
}

export interface LaunchGateDefinition {
  readonly id: string;
  readonly title: string;
  readonly kind: LaunchGateKind;
  readonly required: boolean;
  readonly description: string;
  readonly evidence: readonly EvidencePointer[];
}

export interface LaunchGateResult {
  readonly id: string;
  readonly title: string;
  readonly kind: LaunchGateKind;
  readonly required: boolean;
  readonly status: LaunchGateStatus;
  readonly message: string;
  readonly evidence: readonly EvidencePointer[];
}

export interface HumanAttestationRecord {
  readonly gateId: string;
  readonly attestedBy: string;
  readonly attestedAt: string;
  readonly evidenceRef?: string;
  readonly notes?: string;
}

export interface HumanAttestationBundle {
  readonly schemaVersion: 1;
  readonly attestations: readonly HumanAttestationRecord[];
}

export interface BetaLaunchEvaluationInput {
  readonly repoRoot: string;
  readonly evaluator: string;
  readonly evaluatedAt?: string;
  readonly attestations?: HumanAttestationBundle;
  readonly skipOptional?: boolean;
}

export interface BetaLaunchEvaluationReport {
  readonly schemaVersion: typeof BETA_LAUNCH_DECISION_SCHEMA_VERSION;
  readonly bead: 'BB-063';
  readonly evaluator: string;
  readonly evaluatedAt: string;
  readonly decision: LaunchDecision;
  readonly requiredFailed: number;
  readonly requiredPassed: number;
  readonly optionalFailed: number;
  readonly gates: readonly LaunchGateResult[];
}
