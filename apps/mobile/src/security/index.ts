/**
 * Mobile security surface (MOB-010): client-header attestation and log
 * redaction. See README.md in this directory for the privacy/SDK inventory
 * pointer.
 */
export {
  createApiClient,
  CLIENT_VERSION_HEADER,
  type ApiClient,
  type ApiClientConfig,
  type ApiRequestOptions,
} from './api-client';
export {
  redactForLog,
  redactedLogLine,
  isSensitiveKey,
  REDACTED,
} from './log-redaction';
export { createDefaultApiClient } from './bootstrap';
