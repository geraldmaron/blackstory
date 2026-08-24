/**
 * Maintenance-mode policy: the pure decision layer behind the edge wall.
 *
 * The point of this module is cost, not aesthetics. When the wall is up, a request must be
 * answered *at the edge* — before Next routes it, before a serverless function boots, and
 * before anything opens a Postgres connection to `bb_public`. Every decision here is therefore
 * synchronous, allocation-light, and free of I/O.
 *
 * Toggling requires a redeploy. `process.env.MAINTENANCE_MODE` is read inside the edge bundle,
 * and Next inlines non-public env vars into that bundle at build time, so changing the variable
 * in the Vercel dashboard does nothing until the project is redeployed. This is a deliberate
 * accepted cost: an instant, no-rebuild toggle means Edge Config (an extra product, an extra
 * read on every request), which is the wrong trade for parking a site for weeks.
 */

/** Cookie that carries a granted bypass. Name is deliberately boring and non-identifying. */
export const MAINTENANCE_BYPASS_COOKIE = 'bs_maint_bypass' as const;

/** Query parameter that redeems a bypass token and exchanges it for the cookie. */
export const MAINTENANCE_BYPASS_PARAM = 'maintenance_bypass' as const;

/** Header form of the bypass, for uptime checks and scripts that cannot hold a cookie. */
export const MAINTENANCE_BYPASS_HEADER = 'x-maintenance-bypass' as const;

/** How long a redeemed bypass cookie lasts, in seconds (30 days). */
export const MAINTENANCE_BYPASS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Default `Retry-After`, in seconds. One day: honest for an open-ended data migration. */
export const DEFAULT_RETRY_AFTER_SECONDS = 86_400;

/**
 * Paths that stay reachable while the wall is up.
 *
 * Short list on purpose. `/_next/static` and `/_next/image` are here so a *bypassed* operator
 * gets a working site rather than an unstyled one; `/brand` is here because the maintenance page
 * itself renders the lockup from it. Everything else — including `/robots.txt` and
 * `/sitemap.xml` — is walled, which is the intended crawler signal: a site-wide 503 tells Google
 * to stop crawling and come back later rather than to reindex every URL as a maintenance notice.
 */
const ALWAYS_ALLOWED_PREFIXES = ['/_next/static', '/_next/image', '/brand/'] as const;

const ALWAYS_ALLOWED_EXACT = ['/favicon.ico'] as const;

export interface MaintenanceSettings {
  /** True when the wall should be up. */
  readonly enabled: boolean;
  /** Shared secret that redeems a bypass. Empty string disables bypass entirely. */
  readonly bypassToken: string;
  /** Seconds advertised in `Retry-After`. */
  readonly retryAfterSeconds: number;
  /** Optional operator-supplied body copy; falls back to the built-in notice. */
  readonly message?: string;
}

export type MaintenanceDecision =
  /** Wall is down, or the path is exempt: continue to normal handling. */
  | { readonly kind: 'pass' }
  /** Caller proved the bypass by cookie or header: continue to normal handling. */
  | { readonly kind: 'bypass' }
  /** Caller presented a valid token in the query string: set the cookie and redirect clean. */
  | { readonly kind: 'grant-bypass' }
  /** Wall is up and the caller has no bypass: serve the 503. */
  | { readonly kind: 'block' };

/** Read maintenance settings out of the environment. Fails *open* on a missing flag. */
export function readMaintenanceSettings(
  env: Record<string, string | undefined> = process.env,
): MaintenanceSettings {
  // Spread-conditional rather than `message: ... ?? undefined`: `exactOptionalPropertyTypes`
  // treats an explicit `undefined` as a different thing from an absent key.
  const message = env.MAINTENANCE_MESSAGE?.trim();
  return {
    enabled: isTruthyFlag(env.MAINTENANCE_MODE),
    bypassToken: (env.MAINTENANCE_BYPASS_TOKEN ?? '').trim(),
    retryAfterSeconds: parseRetryAfter(env.MAINTENANCE_RETRY_AFTER_SECONDS),
    ...(message ? { message } : {}),
  };
}

/**
 * Fails open, unlike the kill switches in `@repo/config`.
 *
 * Those switches stop a *workload* and default to deny because running a workload you meant to
 * stop is the expensive failure. This flag stops the *entire public surface*, where the
 * expensive failure runs the other way: a typo, a missing variable, or a stray whitespace must
 * never dark the site. So only an explicit affirmative value raises the wall.
 */
function isTruthyFlag(raw: string | undefined): boolean {
  if (typeof raw !== 'string') {
    return false;
  }
  const value = raw.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'enabled';
}

function parseRetryAfter(raw: string | undefined): number {
  const parsed = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
  // Cap at a week. `Retry-After` is advisory, but a wildly long value invites a crawler to
  // forget the site rather than to wait for it.
  return Math.min(parsed, 60 * 60 * 24 * 7);
}

/** True when a path must be served normally even with the wall up. */
export function isMaintenanceExemptPath(pathname: string): boolean {
  if ((ALWAYS_ALLOWED_EXACT as readonly string[]).includes(pathname)) {
    return true;
  }
  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export interface MaintenanceRequestFacts {
  readonly pathname: string;
  /** Value of the bypass query parameter, if present. */
  readonly bypassParam: string | null;
  /** Value of the bypass cookie, if present. */
  readonly bypassCookie: string | null;
  /** Value of the bypass header, if present. */
  readonly bypassHeader: string | null;
}

/** Decide what the edge should do with one request. Pure; no I/O, no request object. */
export function decideMaintenance(
  settings: MaintenanceSettings,
  facts: MaintenanceRequestFacts,
): MaintenanceDecision {
  if (!settings.enabled) {
    return { kind: 'pass' };
  }
  if (isMaintenanceExemptPath(facts.pathname)) {
    return { kind: 'pass' };
  }

  const { bypassToken } = settings;
  if (bypassToken.length === 0) {
    // No token configured means no bypass exists. Checked before the comparisons below so an
    // empty cookie can never match an empty configured token.
    return { kind: 'block' };
  }

  // Query redemption is checked first so an operator with a stale or wrong cookie can fix it by
  // pasting the link again rather than by hunting for devtools.
  if (facts.bypassParam !== null && secretsMatch(facts.bypassParam, bypassToken)) {
    return { kind: 'grant-bypass' };
  }
  if (facts.bypassCookie !== null && secretsMatch(facts.bypassCookie, bypassToken)) {
    return { kind: 'bypass' };
  }
  if (facts.bypassHeader !== null && secretsMatch(facts.bypassHeader, bypassToken)) {
    return { kind: 'bypass' };
  }

  return { kind: 'block' };
}

/**
 * Length-independent comparison of two secrets.
 *
 * `node:crypto.timingSafeEqual` is not available in the edge runtime and `crypto.subtle` is
 * async, which a synchronous proxy cannot await without changing its shape. This compares every
 * byte of a fixed-length digest-free encoding: it leaks the *length* of the candidate (already
 * observable from the request) but not which byte diverged.
 */
export function secretsMatch(candidate: string, expected: string): boolean {
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(expected);
  // Compare against `b` always, so the loop count depends on the configured secret, not the
  // attacker-supplied one.
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < b.length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}
