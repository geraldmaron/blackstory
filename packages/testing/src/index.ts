/**
 * Shared test builders, guards, harnesses, and deterministic helpers for Black Book.
 * Expanded under BB-008 for multi-layer automated quality foundations.
 */
export const TESTING_PACKAGE = '@black-book/testing' as const;

export { captureLines, createSequence, fixedClock, steppingClock } from './utilities.js';
export type { CapturedLines } from './utilities.js';

export { createIdFactory, defaultIdFactories } from './ids.js';
export type { IdFactory } from './ids.js';

export {
  ClaimBuilder,
  EntityBuilder,
  EvidenceBuilder,
  PublicationReleaseBuilder,
  SourceBuilder,
  SubmissionBuilder,
  buildClaim,
  buildEntity,
  buildEvidence,
  buildPublicationRelease,
  buildSource,
  buildSubmission,
} from './builders/index.js';
export type {
  ClaimFixture,
  ClaimStatus,
  EntityFixture,
  EntityKind,
  EvidenceFixture,
  LivingStatus,
  PublicationReleaseFixture,
  ReleaseStatus,
  SourceFixture,
  SubmissionFixture,
  SubmissionKind,
  SubmissionStatus,
} from './builders/index.js';

export {
  PRODUCTION_OVERRIDE_ENV,
  assertTestsCannotAccessProduction,
  collectProductionGuardFindings,
  isLocalDatabaseUrl,
  looksLikeProductionProjectId,
} from './guards/production.js';
export type { EnvironmentLike, ProductionGuardFinding } from './guards/production.js';

export {
  assertQuarantineRegistryHealthy,
  isQuarantined,
  loadQuarantineRegistry,
  quarantineRegistryPath,
  validateQuarantineRegistry,
} from './quarantine/registry.js';
export type {
  QuarantineEntry,
  QuarantineRegistry,
  QuarantineValidationIssue,
} from './quarantine/registry.js';

export {
  REQUIRE_POSTGRES_ENV,
  createPostgresHarness,
  postgresHarnessGate,
} from './harness/postgres.js';
export type { PostgresHarness } from './harness/postgres.js';

export {
  REQUIRE_FIREBASE_ENV,
  createFirebaseHarness,
  firebaseHarnessGate,
} from './harness/firebase.js';
export type { FirebaseHarness } from './harness/firebase.js';

export { auditHtmlSmoke } from './a11y/html-smoke.js';
export type { A11yFixtureIssue } from './a11y/html-smoke.js';

export { assertHealthContract } from './contract/health.js';
export type { HealthContract } from './contract/health.js';

export {
  CONTROL_QUADRANTS,
  REQUIRED_ABUSE_CASE_IDS,
  REQUIRED_THREAT_IDS,
  loadThreatCorpus,
  threatCorpusPath,
  validateThreatCorpus,
} from './security/threat-corpus.js';

export type {
  ControlQuadrant,
  CorpusValidationIssue,
  ThreatControls,
  ThreatCorpus,
  ThreatRecord,
} from './security/threat-corpus.js';

export * from './security-gates/index.js';
export * from './gold-corpus/index.js';
