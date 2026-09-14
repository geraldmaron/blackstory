/**
 * Local barrel for the mobile store release gate.
 */
export { MOBILE_RELEASE_GATES, REQUIRED_HUMAN_RELEASE_GATE_IDS } from './criteria.js';
export type { MobileReleaseGateId } from './criteria.js';

export {
  assertMobileReleaseGo,
  evaluateMobileReleaseGate,
  missingReleaseAttestations,
} from './evaluate.js';

export {
  checkAndroidTargetSdk,
  checkBuildProvenance,
  checkIosAssociatedDomains,
  checkIosBundleIdentity,
  checkIosOsFloorAndDevices,
  checkIosStoreCompliance,
  checkOtaChannelEnvironment,
  checkOtaCodeSigning,
  checkOtaRuntimeVersion,
  runMobileReleaseCheck,
} from './checks.js';

export {
  collectAndroidEvidence,
  collectEasEvidence,
  collectExpectedIdentity,
  collectIosEvidence,
  collectMobileReleaseEvidence,
  parseAaptBadging,
  parseGradleProperties,
  parseReleaseBuildSettings,
  parseTargetBuildPhases,
} from './collect.js';

export {
  ANDROID_REQUIRED_TARGET_SDK,
  MOBILE_RELEASE_DECISION_SCHEMA_VERSION,
  MOBILE_RELEASE_EVIDENCE_SCHEMA_VERSION,
} from './types.js';
export type {
  AndroidEvidence,
  AppVariant,
  EasEvidence,
  ExpectedIdentity,
  IosEvidence,
  MobileReleaseDecisionReport,
  MobileReleaseEvaluationInput,
  MobileReleaseEvidence,
} from './types.js';
