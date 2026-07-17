/**
 * Canonical incoming request size limits (BB-028).
 */

import { REQUEST_SIZE_LIMITS, type RequestSizeKind } from './constants';

export { REQUEST_SIZE_LIMITS, type RequestSizeKind };

export class RequestTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTooLargeError';
  }
}

/** Fail closed when Content-Length exceeds the configured limit. */
export function assertRequestWithinLimit(
  contentLength: number | null | undefined,
  kind: RequestSizeKind,
): void {
  if (contentLength === null || contentLength === undefined) {
    return;
  }
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new RequestTooLargeError('Invalid Content-Length header.');
  }
  const limit = REQUEST_SIZE_LIMITS[kind];
  if (contentLength > limit) {
    throw new RequestTooLargeError(
      `Request ${kind} exceeds limit (${contentLength} bytes > ${limit} bytes).`,
    );
  }
}

/** Returns true when within limit; null/undefined Content-Length is treated as unknown (allowed at edge). */
export function isRequestWithinLimit(
  contentLength: number | null | undefined,
  kind: RequestSizeKind,
): boolean {
  try {
    assertRequestWithinLimit(contentLength, kind);
    return true;
  } catch {
    return false;
  }
}

/** Map Content-Type to the appropriate request size kind. */
export function requestSizeKindForContentType(contentType: string | null): RequestSizeKind {
  if (!contentType) return 'jsonBody';
  const normalized = contentType.toLowerCase();
  if (normalized.includes('application/json')) return 'jsonBody';
  if (normalized.includes('text/plain')) return 'textBody';
  return 'jsonBody';
}
