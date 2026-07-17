
/**
 * Local barrel for beta launch gate harness (parent merges package root).
 */
export { BETA_LAUNCH_GATES, REQUIRED_HUMAN_GATE_IDS } from './criteria.js';
export type { BetaLaunchGateId } from './criteria.js';

export {
  evaluateBetaLaunchGate,
  assertBetaLaunchGo,
  exitCodeForDecision,
  missingHumanAttestations,
} from './evaluate.js';

export {
  validateBetaLaunchDecisionArtifact,
  loadHumanAttestationBundle,
  writeBetaLaunchDecisionArtifact,
} from './artifact.js';

export {
  checkGoldCorpusPrecision,
  checkRestoreRehearsal,
  checkLoadAbuseVerified,
  checkAdversarialIntegrity,
  checkMethodologyCorrections,
  checkDisclaimerFramework,
  checkReleasePipeline,
  checkBetaDisablePath,
  runMachineGateCheck,
} from './evidence-checks.js';
export type { MachineCheckResult } from './evidence-checks.js';

export {
  BETA_LAUNCH_DECISION_SCHEMA_VERSION,
} from './types.js';
export type {
  BetaLaunchEvaluationInput,
  BetaLaunchEvaluationReport,
  EvidencePointer,
  HumanAttestationBundle,
  HumanAttestationRecord,
  LaunchDecision,
  LaunchGateDefinition,
  LaunchGateKind,
  LaunchGateResult,
  LaunchGateStatus,
} from './types.js';
