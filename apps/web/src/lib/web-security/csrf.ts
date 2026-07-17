/**
 * CSRF protection helpers for state-changing forms.
 * Double-submit cookie pattern; corrections and future POST routes can import these.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE_NAME, CSRF_FORM_FIELD, CSRF_HEADER_NAME } from './constants';
import { csrfCookieDefaults, serializeSetCookie } from './cookies';

export { CSRF_COOKIE_NAME, CSRF_FORM_FIELD, CSRF_HEADER_NAME };

/** Generate a cryptographically random CSRF token (hex).  */
export function generateCsrfToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/** Build Set-Cookie header value for the CSRF double-submit cookie.  */
export function buildCsrfSetCookieHeader(token: string): string {
  return serializeSetCookie(CSRF_COOKIE_NAME, token, csrfCookieDefaults());
}

export type CsrfValidationInput = {
  cookieToken?: string | null;
  headerToken?: string | null;
  formToken?: string | null;
};

/**
 * Validate CSRF using double-submit: request token must match HttpOnly cookie.
 * Accepts header (API) or form field (HTML forms).
 */
export function validateCsrfToken(input: CsrfValidationInput): boolean {
  const cookieToken = normalizeToken(input.cookieToken);
  if (!cookieToken) return false;

  const requestToken = normalizeToken(input.headerToken) ?? normalizeToken(input.formToken);
  if (!requestToken) return false;

  const cookieBuf = Buffer.from(cookieToken, 'utf8');
  const requestBuf = Buffer.from(requestToken, 'utf8');
  if (cookieBuf.length !== requestBuf.length) return false;

  return timingSafeEqual(cookieBuf, requestBuf);
}

function normalizeToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
