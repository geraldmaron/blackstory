/**
 * Secure HTTP-only SameSite cookie defaults for the public web surface.
 * The public site is mostly cookieless; helpers exist for CSRF/session when needed.
 */

export type SameSitePolicy = 'strict' | 'lax' | 'none';

export type SecureCookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSitePolicy;
  path?: string;
  maxAge?: number;
  domain?: string;
};

export type SerializedCookie = {
  name: string;
  value: string;
  options: Required<Pick<SecureCookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'path'>> &
    Pick<SecureCookieOptions, 'maxAge' | 'domain'>;
};

/** Production-safe defaults: HttpOnly, Secure, SameSite=Lax.  */
export function secureCookieDefaults(overrides: SecureCookieOptions = {}): SerializedCookie['options'] & Pick<SecureCookieOptions, 'maxAge' | 'domain'> {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: overrides.httpOnly ?? true,
    secure: overrides.secure ?? isProduction,
    sameSite: overrides.sameSite ?? 'lax',
    path: overrides.path ?? '/',
    ...(overrides.maxAge !== undefined ? { maxAge: overrides.maxAge } : {}),
    ...(overrides.domain !== undefined ? { domain: overrides.domain } : {}),
  };
}

/** Stricter defaults for CSRF double-submit cookies (__Host- prefix requires Secure, Path=/, no Domain).  */
export function csrfCookieDefaults(overrides: SecureCookieOptions = {}): SerializedCookie['options'] & Pick<SecureCookieOptions, 'maxAge'> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: overrides.maxAge ?? 3600,
  };
}

/** Serialize a Set-Cookie header fragment (single cookie).  */
export function serializeSetCookie(name: string, value: string, options: SecureCookieOptions = {}): string {
  const resolved = name.startsWith('__Host-')
    ? csrfCookieDefaults(options)
    : secureCookieDefaults(options);

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${resolved.path}`];
  if (resolved.httpOnly) parts.push('HttpOnly');
  if (resolved.secure) parts.push('Secure');
  parts.push(`SameSite=${capitalizeSameSite(resolved.sameSite)}`);
  if ('maxAge' in resolved && resolved.maxAge !== undefined) {
    parts.push(`Max-Age=${resolved.maxAge}`);
  }
  if ('domain' in resolved && resolved.domain) {
    parts.push(`Domain=${resolved.domain}`);
  }
  return parts.join('; ');
}

function capitalizeSameSite(value: SameSitePolicy): string {
  if (value === 'none') return 'None';
  if (value === 'strict') return 'Strict';
  return 'Lax';
}
