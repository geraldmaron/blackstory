/**
 * Response payload size guards for public App Hosting.
 */

import { RESPONSE_SIZE_LIMITS, type ResponseSizeKind } from './constants';

export { RESPONSE_SIZE_LIMITS, type ResponseSizeKind };

/** Measure UTF-8 byte length of a string payload.  */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Fail closed when a serialized payload exceeds the configured public limit.  */
export function assertResponseWithinLimit(bytes: number, kind: ResponseSizeKind): void {
  const limit = RESPONSE_SIZE_LIMITS[kind];
  if (bytes > limit) {
    throw new Error(
      `Public ${kind} response exceeds limit (${bytes} bytes > ${limit} bytes). Refusing to emit oversized payload.`,
    );
  }
}

/** Returns true when within limit; useful for degraded-mode truncation decisions.  */
export function isWithinResponseLimit(bytes: number, kind: ResponseSizeKind): boolean {
  return bytes <= RESPONSE_SIZE_LIMITS[kind];
}

/** Guard helper for string payloads before streaming/rendering.  */
export function assertStringResponseWithinLimit(value: string, kind: ResponseSizeKind): void {
  assertResponseWithinLimit(utf8ByteLength(value), kind);
}
