/**
 * Edge middleware security checks composed with BB-022 query normalization (BB-028).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleQueryNormalization } from '../runtime-hardening/edge-query-normalization';
import { applySecurityHeaders } from './security-headers';
import {
  assertRequestWithinLimit,
  requestSizeKindForContentType,
  RequestTooLargeError,
} from './request-size-limits';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Run request guards, attach security headers, then delegate query normalization. */
export function handleWebSecurity(request: NextRequest): NextResponse {
  try {
    enforceRequestSizeLimit(request);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return new NextResponse('Payload Too Large', { status: 413 });
    }
    throw error;
  }

  const normalizationResponse = handleQueryNormalization(request);
  applySecurityHeaders(normalizationResponse.headers);
  return normalizationResponse;
}

function enforceRequestSizeLimit(request: NextRequest): void {
  if (!STATE_CHANGING_METHODS.has(request.method)) {
    return;
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (!contentLengthHeader) {
    return;
  }

  const contentLength = Number.parseInt(contentLengthHeader, 10);
  const kind = requestSizeKindForContentType(request.headers.get('content-type'));
  assertRequestWithinLimit(contentLength, kind);
}
