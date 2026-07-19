/**
 * Mobile security surface (MOB-010): App Check attestation, token attachment,
 * enforcement staging, and log redaction. See README.md in this directory for
 * the App Check monitor→enforce cutover runbook and the privacy/SDK inventory
 * pointer.
 */
export {
  resolveAppCheckProviderConfig,
  initializeAppCheckClient,
  getAppCheckToken,
  type AppCheckProviderConfig,
  type AppCheckInitResult,
  type AppVariant,
  type AppleAppCheckProvider,
  type AndroidAppCheckProvider,
} from './app-check';
export {
  createApiClient,
  APP_CHECK_HEADER,
  CLIENT_VERSION_HEADER,
  type ApiClient,
  type ApiClientConfig,
  type ApiRequestOptions,
  type TokenProvider,
} from './api-client';
export {
  resolveEnforcementMode,
  DEFAULT_APP_CHECK_ENFORCEMENT_MODE,
  type AppCheckEnforcementMode,
} from './enforcement';
export {
  redactForLog,
  redactedLogLine,
  isSensitiveKey,
  REDACTED,
} from './log-redaction';
export {
  bootstrapAppCheck,
  createDefaultApiClient,
  currentEnforcementMode,
} from './bootstrap';
