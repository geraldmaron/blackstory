/**
 * Stable HTTP response primitives for the api-submissions corrections route (MOB-016 / repo-zir9).
 *
 * Error bodies mirror web's corrections handler (`{ error, reason?, issues? }`) so the mobile
 * client and web route share one wire envelope — not the public-read API's structured error codes.
 */
import { randomUUID } from 'node:crypto';

export type ApiResponse = {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
};

export function newRequestId(): string {
  return `req_${randomUUID()}`;
}

export function jsonResponse(
  status: number,
  body: unknown,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): ApiResponse {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
      ...extraHeaders,
    },
    body,
  };
}

export function jsonError(
  status: number,
  error: string,
  requestId: string,
  extra?: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): ApiResponse {
  return jsonResponse(status, { error, ...extra }, requestId, extraHeaders);
}
