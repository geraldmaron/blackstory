/**
 * Safe redirect handling open-redirect resistance.
 */

import { SAFE_REDIRECT_PREFIX } from './constants';

export class UnsafeRedirectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeRedirectError';
  }
}

function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export type SafeRedirectOptions = {
  /** When set, also allow absolute URLs on this origin (default: relative only).  */
  allowedOrigin?: string;
};

/**
 * Assert a redirect target is same-origin relative or explicitly allowed.
 * Rejects protocol-relative, javascript:, backslash, and off-site absolute URLs.
 */
export function assertSafeRedirect(target: string, options: SafeRedirectOptions = {}): string {
  if (typeof target !== 'string') {
    throw new UnsafeRedirectError('Redirect target must be a string.');
  }

  const trimmed = target.trim();
  if (!trimmed) {
    throw new UnsafeRedirectError('Redirect target must not be empty.');
  }

  if (containsControlCharacters(trimmed)) {
    throw new UnsafeRedirectError('Redirect target contains control characters.');
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new UnsafeRedirectError('Redirect target uses a forbidden scheme.');
  }

  if (trimmed.startsWith('//')) {
    throw new UnsafeRedirectError('Protocol-relative redirects are not allowed.');
  }

  if (trimmed.includes('\\')) {
    throw new UnsafeRedirectError('Backslash redirects are not allowed.');
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    if (!options.allowedOrigin) {
      throw new UnsafeRedirectError('Absolute redirects require an allowed origin.');
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new UnsafeRedirectError('Redirect target is not a valid URL.');
    }
    const allowed = new URL(options.allowedOrigin);
    if (parsed.origin !== allowed.origin) {
      throw new UnsafeRedirectError('Redirect target origin is not allowed.');
    }
    return parsed.pathname + parsed.search + parsed.hash;
  }

  if (!trimmed.startsWith(SAFE_REDIRECT_PREFIX)) {
    throw new UnsafeRedirectError('Redirect target must be a same-site relative path.');
  }

  if (trimmed.startsWith('//')) {
    throw new UnsafeRedirectError('Protocol-relative redirects are not allowed.');
  }

  return trimmed;
}

/** Returns true when assertSafeRedirect would succeed.  */
export function isSafeRedirect(target: string, options: SafeRedirectOptions = {}): boolean {
  try {
    assertSafeRedirect(target, options);
    return true;
  } catch {
    return false;
  }
}
