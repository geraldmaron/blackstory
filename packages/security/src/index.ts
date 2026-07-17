/**
 * @black-book/security — central redaction and public serialization layer (BB-015).
 *
 * This package is the single choke point that reduces location precision and scrubs
 * protected values (living residential addresses, exact coordinates) before anything
 * reaches a public surface: APIs, search indexes, projections, logs, telemetry, and
 * exports. All policy is sourced from the product constitution (@black-book/schemas).
 */
export const SECURITY_PACKAGE = '@black-book/security' as const;

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
