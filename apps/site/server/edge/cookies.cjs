/**
 * Cookie helpers. Port of the defaults in apps/web/src/lib/web-security/cookies.ts
 * (httpOnly, Secure in production, SameSite=Lax, Path=/).
 */

function secureCookieDefaults(overrides = {}) {
  return {
    httpOnly: overrides.httpOnly ?? true,
    secure: overrides.secure ?? process.env.NODE_ENV === 'production',
    sameSite: overrides.sameSite ?? 'lax',
    path: overrides.path ?? '/',
    ...(overrides.maxAge !== undefined ? { maxAge: overrides.maxAge } : {}),
    ...(overrides.domain !== undefined ? { domain: overrides.domain } : {}),
    ...(overrides.expires !== undefined ? { expires: overrides.expires } : {}),
  };
}

const SAME_SITE = { lax: 'Lax', strict: 'Strict', none: 'None' };

/** Serialize one Set-Cookie header value from a name, value and options. */
function serializeSetCookie(name, value, options = {}) {
  const o = secureCookieDefaults(options);
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path}`];
  if (o.httpOnly) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  parts.push(`SameSite=${SAME_SITE[String(o.sameSite).toLowerCase()] ?? 'Lax'}`);
  if (o.maxAge !== undefined) parts.push(`Max-Age=${o.maxAge}`);
  if (o.expires !== undefined) parts.push(`Expires=${new Date(o.expires).toUTCString()}`);
  if (o.domain) parts.push(`Domain=${o.domain}`);
  return parts.join('; ');
}

/** Parse a Cookie request header into [{name, value}] (values URI-decoded when possible). */
function parseCookieHeader(header) {
  if (!header) return [];
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=');
      const name = index === -1 ? part : part.slice(0, index);
      const raw = index === -1 ? '' : part.slice(index + 1);
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        /* keep the raw value */
      }
      return { name: name.trim(), value };
    });
}

module.exports = { secureCookieDefaults, serializeSetCookie, parseCookieHeader };
