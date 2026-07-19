
/**
 * Security telemetry redaction strips App Check tokens, credentials, and protected
 * addresses before events reach logs or exported metrics.
 */
import { createSensitiveDataRedactor } from '@repo/security';
import type { SecurityTelemetryEvent } from './security-events.js';

/** Keys that must never appear in security telemetry output (case-insensitive). */
export const SECURITY_SENSITIVE_KEYS = [
  'appchecktoken',
  'app_check_token',
  'x-firebase-appcheck',
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'secret',
  'apikey',
  'api_key',
  'token',
  'idtoken',
  'id_token',
  'refreshtoken',
  'refresh_token',
  'privatekey',
  'private_key',
  'credential',
  'session',
  'jwt',
] as const;

const securityRedactor = createSensitiveDataRedactor({
  extraKeys: SECURITY_SENSITIVE_KEYS,
  dropKeys: true,
});

/** Redact arbitrary metadata attached to a security event. */
export function redactSecurityMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  return securityRedactor(metadata) as Readonly<Record<string, unknown>>;
}

/** Produce a log-safe copy of a security telemetry event. */
export function redactSecurityEvent(event: SecurityTelemetryEvent): SecurityTelemetryEvent {
  const redactedMetadata = redactSecurityMetadata(event.metadata);
  return {
    ...event,
    ...(redactedMetadata === undefined ? {} : { metadata: redactedMetadata }),
  };
}

/** Hash or truncate an opaque identifier for metric dimensions (never emit raw value). */
export function fingerprintDimension(value: string, maxLength = 12): string {
  if (value.length <= maxLength) {
    return value;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `fp_${hash.toString(16).padStart(8, '0')}`;
}
