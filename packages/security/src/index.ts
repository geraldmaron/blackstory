/**
 * @repo/security central redaction and public serialization layer.
 *
 * This package is the single choke point that reduces location precision and scrubs
 * protected values (living residential addresses, exact coordinates) before anything
 * reaches a public surface: APIs, search indexes, projections, logs, telemetry, and
 * exports. All policy is sourced from the product constitution (@repo/schemas).
 */
export const SECURITY_PACKAGE = '@repo/security' as const;

export {
  sensitivityClasses,
  precisionReductionReasons,
  residentialPrecisionLevels,
  isResidentialPrecision,
  assertSensitivityClass,
} from './sensitivity.js';
export type { PrecisionTier, SensitivityClass, PrecisionReductionReason } from './sensitivity.js';

export {
  reducePublicPrecision,
  redactLocationForPublic,
  createSensitiveDataRedactor,
  redactSensitiveValues,
  PROTECTED_FIELD_KEYS,
} from './redaction.js';
export type {
  PrecisionReductionInput,
  PrecisionReductionResult,
  InternalLocationInput,
  PublicLocation,
  RedactorOptions,
  LivingStatusInput,
} from './redaction.js';

export {
  assertNoProhibitedPublicPrecision,
  assertPublicProjectionSafe,
  toPublicEntityProjection,
  toPublicSearchDocument,
  redactForPublicExport,
} from './serialize.js';
export type {
  PublicSerializableEntity,
  PublicProjectionLocation,
  PublicEntityProjection,
  PublicSearchDocument,
  PublicEntityProjectionOptions,
} from './serialize.js';

export {
  RATE_LIMIT_POLICY_VERSION,
  DEFAULT_ENDPOINT_QUOTA_MATRIX,
  OUTAGE_DEGRADED_QUOTA_FACTOR,
  deriveOutageDegradedPolicy,
  endpointClasses,
  rateLimitSubjects,
  appCheckAvailabilityStates,
  safeRetryAfter,
  formatRateLimitResponse,
  aggregateRiskScore,
  aggregateDistributedRisk,
  buildRateLimitKey,
  createInMemoryRateLimitStore,
  createRateLimitEvaluator,
  evaluateQuota,
  releaseConcurrency,
  resolveEndpointPolicy,
  compareSubjectQuota,
  isExpensiveEndpointStricter,
  assertSubjectQuotaOrdering,
} from './rate-limits.js';
export type {
  RateLimitSubject,
  EndpointClass,
  AppCheckAvailability,
  RiskSignalKind,
  RiskSignal,
  QuotaDenialReason,
  QuotaDecisionAllowed,
  QuotaDecisionDenied,
  QuotaDecision,
  EndpointQuotaPolicy,
  RateLimitEvaluateInput,
  TokenBucketState,
  RateLimitStoreEntry,
  RateLimitStore,
  RateLimitStoreOptions,
  RateLimitEvaluatorOptions,
  RateLimitResponseBody,
  RateLimitHttpResponse,
  DistributedRiskAggregation,
} from './rate-limits.js';

export {
  QUERY_GUARDRAIL_POLICY_VERSION,
  SEARCH_ENDPOINT_CLASS,
  searchSortKeys,
  searchFilterFields,
  DEFAULT_QUERY_GUARDRAIL_LIMITS,
  normalizeSearchText,
  canonicalizeForCacheKey,
  assertNoProhibitedQueryFields,
  isWildcardOnlyQuery,
  looksLikeRegexInput,
  estimateQueryCost,
  hashCanonicalQuery,
  buildSearchCacheKey,
  encodeSearchCursor,
  decodeSearchCursor,
  getQueryTimeoutPolicy,
  createTimeoutFailure,
  createSlowQueryLogEvent,
  searchQueryEndpointMetadata,
  evaluateSearchQueryGuardrails,
} from './query-guardrails.js';
export type {
  SearchSortKey,
  SearchFilterField,
  ApprovedQueryShape,
  SearchFilter,
  SearchGeoInput,
  SearchDateRange,
  SearchQueryInput,
  CanonicalSearchQuery,
  QueryGuardrailDenialReason,
  QueryGuardrailDecisionAllowed,
  QueryGuardrailDecisionDenied,
  QueryGuardrailDecision,
  QueryGuardrailLimits,
  SearchCursorPayload,
  SlowQueryLogEvent,
  QueryTimeoutPolicy,
  EvaluateSearchQueryOptions,
} from './query-guardrails.js';

export {
  SUBMISSION_QUARANTINE_POLICY_VERSION,
  DEFAULT_SUBMISSION_VALIDATION_LIMITS,
  validateAndNormalizeSubmission,
  scoreSubmissionSpam,
  fingerprintSubmission,
  createSubmissionCampaignDetector,
  createQuarantinedSubmission,
  verifyOriginalIntegrity,
} from './submissions/index.js';
export type {
  SubmissionKind,
  SubmissionInboxState,
  SubmissionModerationState,
  SubmissionInput,
  NormalizedSubmission,
  SubmissionValidationReason,
  SubmissionValidationIssue,
  SubmissionValidationLimits,
  SubmissionValidationOptions,
  SubmissionValidationResult,
  SpamSignal,
  SpamAssessment,
  SubmissionPrivacy,
  SubmissionCampaignAssessment,
  SubmissionOriginal,
  QuarantinedSubmissionRecord,
  RejectedSubmission,
  SubmissionIntakeResult,
  CampaignObservation,
  CampaignDetectorOptions,
  SubmissionIntakeContext,
} from './submissions/index.js';

export {
  RESOURCE_CONTROL_POLICY_VERSION,
  BB022_APP_HOSTING_LIMITS,
  BB025_POLICY_REF,
  DEFAULT_SERVICE_SCALING_LIMITS,
  DEFAULT_CLOUD_TASKS_POLICIES,
  DEFAULT_CLOUD_RUN_JOB_POLICIES,
  DEFAULT_DATABASE_LIMITS,
  DEFAULT_DAILY_BUDGETS,
  DEFAULT_RESEARCH_CAMPAIGN_BUDGET,
  DEFAULT_BILLING_ALERTS,
  DEFAULT_SOFT_SHUTDOWN_POLICY,
  computeRetryDelay,
  isRetryBudgetExhausted,
  assertAllServicesBounded,
  assertShutdownOrdering,
  assertRetryPoliciesBounded,
  evaluateScalingCap,
  evaluateQueueDispatch,
  evaluateDatabaseAcquire,
  evaluateDailyBudget,
  evaluateSoftShutdown,
  evaluateCircuitBreaker,
  recordCircuitFailure,
  simulateAbusiveTrafficPattern,
} from './resource-controls.js';
export type {
  WorkloadTier,
  ServiceId,
  WorkerJobId,
  CloudTasksQueueId,
  BudgetCategory,
  CircuitBreakerState,
  ResourceDenialReason,
  RetryPolicy,
  ServiceScalingLimits,
  CloudTasksQueuePolicy,
  CloudRunJobPolicy,
  DatabaseResourceLimits,
  DailyBudgetPolicy,
  BudgetAutomatedResponse,
  ResearchCampaignBudget,
  BillingAlertPolicy,
  SoftShutdownPolicy,
  ResourceControlDecisionAllowed,
  ResourceControlDecisionDenied,
  ResourceControlDecision,
  EvaluateScalingInput,
  EvaluateQueueDispatchInput,
  EvaluateDatabaseAcquireInput,
  EvaluateBudgetInput,
  BudgetEvaluation,
  EvaluateSoftShutdownInput,
  CircuitBreakerConfig,
  CircuitBreakerSnapshot,
  AbusiveTrafficStep,
  AbusiveTrafficSimulationResult,
} from './resource-controls.js';

// Node-only URL safety — import via `@repo/security/url-safety`, never the main barrel
// (client webpack graphs that need redactLocationForPublic must use `@repo/security/redaction`).
