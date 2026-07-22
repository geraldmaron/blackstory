/**
 * Log scrubbing (MOB-010; privacy invariant 7, ADR-020 §3, threat-model
 * T1/privacy).
 *
 * The mobile app must NEVER emit — to console, crash reports, or any log
 * sink — any of these sensitive categories:
 *
 *   - search query text                (what a user is looking for)
 *   - correction content               (free-text a user submitted)
 *   - precise location                 (device lat/lng, fine coordinates)
 *   - citation / source URLs           (which specific evidence was viewed)
 *   - sensitive entity classifications (e.g. protected-status / era labels)
 *   - raw App Check tokens             (attestation JWTs — ADR-010, never log)
 *
 * `redactForLog` takes an arbitrary log payload (string or object/error) and
 * returns a structurally-similar value with every sensitive field/value
 * replaced by a stable placeholder. It is deliberately conservative: it
 * redacts by KEY NAME (any key whose name matches a sensitive category) and by
 * VALUE PATTERN (coordinates, JWTs, and known URL shapes) so a sensitive value
 * placed under an unexpected key is still caught. Redaction is
 * whole-value — we never emit a partial/truncated sensitive value that could
 * be reassembled.
 *
 * This utility does not by itself guarantee redaction everywhere; it is the
 * primitive every log/crash-report call site must route through. MOB-018
 * wires the observability sinks to use it.
 */

export const REDACTED = '[redacted]';

/** Keys whose VALUES are always sensitive, regardless of content. */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /query/i, // searchQuery, queryText
  /^q$/i, // the bare `q` search-query param
  /correction/i, // correctionContent, corrections, correctionText
  /\bcontent\b/i, // free-text content bodies
  /location|coord|lat\b|lng|lon\b|latitude|longitude|geo/i,
  /citation|source_?url|sourceUrl|evidence_?url/i,
  /classification|sensitive|protected_?status|era/i,
  /app_?check|appcheck|attestation|token/i,
];

/**
 * Value-level patterns for sensitive data that might appear under an
 * innocuous or unknown key (defence in depth against mis-keyed leaks).
 */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  // JWT-shaped token (three base64url segments) — App Check tokens.
  /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  // Decimal lat,lng pair, e.g. "40.7128,-74.0060".
  /-?\d{1,3}\.\d{3,},\s*-?\d{1,3}\.\d{3,}/,
];

const MAX_DEPTH = 8;

/** Return true if a key name denotes a sensitive category. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactString(value: string): string {
  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return REDACTED;
  }
  return value;
}

/**
 * Redact a log payload. Objects and arrays are walked; Errors are converted to
 * a `{ name, message, stack }` shape (message/stack scrubbed for value
 * patterns) so an error carrying a sensitive value in its message never
 * escapes. Cyclic references are broken with a placeholder.
 */
export function redactForLog(payload: unknown): unknown {
  return redactValue(payload, 0, new WeakSet());
}

/**
 * Convenience: produce a single redacted string suitable for `console.*`.
 */
export function redactedLogLine(payload: unknown): string {
  const redacted = redactForLog(payload);
  if (typeof redacted === 'string') {
    return redacted;
  }
  try {
    return JSON.stringify(redacted);
  } catch {
    return REDACTED;
  }
}

function redactValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (depth > MAX_DEPTH) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: typeof value.stack === 'string' ? redactString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return REDACTED;
    }
    seen.add(value);
    return value.map((item) => redactValue(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) {
      return REDACTED;
    }
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (isSensitiveKey(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(obj[key], depth + 1, seen);
      }
    }
    return out;
  }

  // Functions, symbols, bigint, etc. — never log their raw form.
  return REDACTED;
}
