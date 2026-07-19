/**
 * Shared route-parameter parser/validator for apps/mobile's Expo Router tree (MOB-008).
 *
 * Every screen that accepts a route param (dynamic path segment or query string) MUST run it
 * through this module before use — never inline ad hoc parsing per screen. This is also the
 * primary mitigation surface for threat-model T4 ("Deep-link injection",
 * docs/mobile/security/threat-model.md): malformed, oversized, or unsafe values are discarded
 * and callers fall back to a safe default. Nothing here ever crashes on hostile input, and
 * nothing here forwards an untrusted string into a raw query, filter, or storage path — values
 * are validated against a known shape first and only the validated value is used.
 *
 * File naming note: this directory is prefixed with `_` specifically so Expo Router's
 * file-based router ignores it as a route (a documented Expo Router convention) while it still
 * lives under `src/app/` for colocation with the routes that depend on it.
 *
 * Dependency note: this module intentionally imports nothing beyond the TypeScript standard
 * library. `packages/public-contracts/src/v1/entity.ts` defines the canonical entity id shape
 * server-side (`idString(200)`: trimmed, non-empty, <=200 chars, via zod) — this module's
 * length bound mirrors that, but apps/mobile does not currently depend on
 * `@repo/public-contracts` or `zod` (apps/mobile manages its own npm lockfile with no workspace
 * symlink to `packages/*`, per the package-scope note in
 * docs/mobile/decisions/mobile-identity.md), and adding a new dependency means editing
 * `apps/mobile/package.json`, which is outside this bead's exclusive ownership
 * (`apps/mobile/src/app/**` and `apps/mobile/app.config.ts` only). A future bead that wires
 * apps/mobile into the pnpm workspace should consider importing the real contract schema here
 * instead of hand-mirroring it.
 */

// ---------------------------------------------------------------------------
// Shared bounds
// ---------------------------------------------------------------------------

/** Defensive ceiling on a whole incoming URL string, independent of any single param. */
export const MAX_URL_LENGTH = 2048;

/** Mirrors packages/public-contracts/src/v1/entity.ts's `idString(200)` bound. */
export const MAX_ENTITY_ID_LENGTH = 200;

export const MAX_SEARCH_QUERY_LENGTH = 200;

/** Mirrors packages/public-contracts's `eraBuckets` element bound (`z.string().max(20)`). */
export const MAX_ERA_LENGTH = 20;

/**
 * Mirrors packages/public-contracts/src/v1/entity.ts's `ENTITY_KINDS`. Kept as a manually
 * synced literal list rather than an import — see the dependency note above.
 */
export const ENTITY_KINDS = ['place', 'school', 'event', 'institution'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Expo Router hands a repeated query key (`?q=a&q=b`) to a screen as a string array via
 * `useLocalSearchParams`. Duplicate params are a known ambiguity vector (T4's "duplicate query
 * params" fuzz case) — this project's policy is: deterministically take the first value, never
 * silently concatenate/join them, never take the last (which could let a second, attacker-added
 * copy of a param override an intended first one after another layer already validated it).
 */
function firstOf(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Decodes a percent-encoded string defensively: malformed percent-encoding (a bare `%`, `%zz`,
 * a truncated escape at the end of the string, etc.) makes `decodeURIComponent` throw — that is
 * treated as "reject", never "pass through un-decoded" or "crash". Decoding is repeated up to a
 * small fixed number of times so a *double*-encoded traversal/redirect payload (e.g.
 * `%252e%252e%252f`, which decodes once to the literal text `%2e%2e%2f` and only decodes to
 * `../` on a second pass) can't slip past a single-decode charset/pattern check later in the
 * pipeline. The loop is bounded (not "decode until stable") so a crafted input can't force
 * unbounded work.
 */
const MAX_DECODE_PASSES = 3;

function safeDecodeRepeated(value: string): string | null {
  let current = value;
  try {
    for (let i = 0; i < MAX_DECODE_PASSES; i += 1) {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    }
  } catch {
    return null;
  }
  return current;
}

/** Strips ASCII control characters (including CR/LF, which could otherwise smuggle header-like
 * content into logs or downstream text) from a string. */
function stripControlChars(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) continue;
    result += value[i];
  }
  return result;
}

/**
 * Recognizes strings that look like an attempt to redirect navigation somewhere outside the
 * app's own known route tree: absolute URLs with a scheme (`https:`, `javascript:`, `data:`,
 * the app's own `blackstory:` scheme included — a value should never re-enter as a scheme),
 * protocol-relative URLs (`//evil.example.com`), and backslash variants some URL parsers
 * normalize to forward slashes.
 */
function looksLikeExternalTarget(value: string): boolean {
  const normalized = value.trim();
  if (normalized === '') return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return true; // any scheme prefix, e.g. https:, javascript:
  if (normalized.startsWith('//')) return true; // protocol-relative
  if (normalized.startsWith('\\\\') || normalized.startsWith('/\\') || normalized.startsWith('\\/')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Entity id
// ---------------------------------------------------------------------------

/**
 * Real ids look like `ent_caam_los_angeles_001` (see
 * packages/firebase/fixtures/national-catalog/*.json): lowercase ASCII letters, digits,
 * underscore, hyphen. This is intentionally an *allowlist*, stricter than the generic
 * server-side `idString` bound (which is any non-empty trimmed string) — threat-model T4
 * explicitly calls for "character set + length" validation on the mobile side before an
 * embedded identifier is used, since it arrives over a fully attacker-controlled channel (a
 * link), unlike an internal API response.
 */
const ENTITY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,199}$/;

/**
 * Validates and returns a safe entity id, or `null` if the input is missing, malformed, unsafe,
 * or oversized. Accepts `unknown` because it is meant to be called directly on whatever
 * `useLocalSearchParams()`/a deep-link path segment/a persisted-state blob hands back, which is
 * untyped at the boundary.
 */
export function parseEntityId(raw: unknown): string | null {
  const value = firstOf(raw);
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > MAX_ENTITY_ID_LENGTH) return null;

  const decoded = safeDecodeRepeated(value);
  if (decoded === null) return null;
  if (decoded.length === 0 || decoded.length > MAX_ENTITY_ID_LENGTH) return null;

  // Reject rather than silently trim: a structural id should never carry incidental whitespace.
  if (decoded.trim() !== decoded) return null;

  if (!ENTITY_ID_PATTERN.test(decoded)) return null;

  // Redundant with the pattern above (which has no `.`/`/`/`\`), but explicit and independently
  // testable defense-in-depth against path traversal specifically, per T4's fuzz corpus.
  if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) return null;

  return decoded;
}

// ---------------------------------------------------------------------------
// Search query
// ---------------------------------------------------------------------------

/**
 * Sanitizes free-text search input. Unlike an id, this is not a closed charset — but it is
 * still bounded in length, stripped of control characters, and rejected outright (returned as
 * `''`, the safe empty-query default) if it looks like an attempt to smuggle a navigation
 * target through a text field. Program invariant 7 also means search text itself is never
 * logged by any caller of this function — that discipline lives in the observability layer
 * (MOB-018), not here, but this function's job is to make sure what reaches that layer (or a
 * server request) is at least bounded and control-character-free.
 */
export function parseSearchQuery(raw: unknown): string {
  const value = firstOf(raw);
  if (typeof value !== 'string') return '';
  if (value.length > MAX_SEARCH_QUERY_LENGTH) return '';

  const decoded = safeDecodeRepeated(value);
  if (decoded === null) return '';

  const stripped = stripControlChars(decoded).trim();
  if (stripped === '' || stripped.length > MAX_SEARCH_QUERY_LENGTH) return '';
  if (looksLikeExternalTarget(stripped)) return '';

  return stripped;
}

// ---------------------------------------------------------------------------
// Filter state (used by the Explore tab and the filter sheet)
// ---------------------------------------------------------------------------

export type FilterState = {
  readonly kind?: EntityKind;
  readonly era?: string;
};

const ERA_PATTERN = /^[a-z0-9-]{1,20}$/i;

function parseKindParam(raw: unknown): EntityKind | undefined {
  const value = firstOf(raw);
  if (typeof value !== 'string') return undefined;
  const decoded = safeDecodeRepeated(value);
  if (decoded === null) return undefined;
  const trimmed = decoded.trim().toLowerCase();
  return isEntityKind(trimmed) ? trimmed : undefined;
}

function parseEraParam(raw: unknown): string | undefined {
  const value = firstOf(raw);
  if (typeof value !== 'string') return undefined;
  if (value.length > MAX_ERA_LENGTH) return undefined;
  const decoded = safeDecodeRepeated(value);
  if (decoded === null) return undefined;
  const trimmed = decoded.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ERA_LENGTH) return undefined;
  if (!ERA_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Builds a validated `FilterState` from an arbitrary params object (route query params or a
 * persisted blob). Unknown keys and unknown/malformed values are silently dropped — the result
 * only ever contains fields that passed validation, never a passthrough of the input.
 */
export function parseFilterState(raw: Record<string, unknown> | undefined | null): FilterState {
  if (!raw || typeof raw !== 'object') return {};
  const kind = parseKindParam(raw.kind);
  const era = parseEraParam(raw.era);
  return {
    ...(kind !== undefined ? { kind } : {}),
    ...(era !== undefined ? { era } : {}),
  };
}

// ---------------------------------------------------------------------------
// Safe-route allowlist (open-redirect / unknown-route defense)
// ---------------------------------------------------------------------------

/** The only static (parameter-free) tab roots a deep link is allowed to resolve to. */
const ALLOWED_STATIC_ROUTES = ['/explore', '/search', '/learn', '/more'] as const;

export type SafeInternalPath = (typeof ALLOWED_STATIC_ROUTES)[number] | `/entity/${string}`;

/**
 * Returns true only for a small, explicit allowlist of internal app routes: the four tab roots,
 * or `/entity/<validated-id>`. Used anywhere a link/param carries a "navigate to" target that
 * isn't itself the current screen's own route — e.g. a `returnTo` param on a modal sheet — so
 * that value can never be used to open an external URL (an "open redirect") or an unknown/
 * unenumerated route. This is the concrete implementation of T4's "route allowlist, not string
 * dispatch" mitigation.
 */
export function isSafeInternalPath(raw: unknown): raw is SafeInternalPath {
  if (typeof raw !== 'string') return false;
  if (raw.length === 0 || raw.length > 512) return false;
  if (!raw.startsWith('/')) return false;
  if (looksLikeExternalTarget(raw)) return false;
  if (raw.includes('..')) return false;

  if ((ALLOWED_STATIC_ROUTES as readonly string[]).includes(raw)) return true;

  const entityMatch = /^\/entity\/([^/]+)$/.exec(raw);
  if (entityMatch) {
    return parseEntityId(entityMatch[1]) !== null;
  }

  return false;
}

/**
 * Validates a `returnTo`/`next`-style param against the safe-route allowlist. Returns `null`
 * (never the raw value) if the target is missing, malformed, or looks like an open-redirect
 * attempt (an absolute URL, a protocol-relative URL, or any path outside the known route tree).
 */
export function parseReturnTo(raw: unknown): SafeInternalPath | null {
  const value = firstOf(raw);
  if (typeof value !== 'string') return null;
  const decoded = safeDecodeRepeated(value);
  if (decoded === null) return null;
  return isSafeInternalPath(decoded) ? (decoded as SafeInternalPath) : null;
}

// ---------------------------------------------------------------------------
// Incoming URL guard (overlong URLs)
// ---------------------------------------------------------------------------

/** Rejects an incoming URL outright if it exceeds a sane maximum length, independent of what any
 * individual parameter parser would otherwise accept. */
export function isUrlLengthSafe(url: unknown): url is string {
  return typeof url === 'string' && url.length > 0 && url.length <= MAX_URL_LENGTH;
}

// ---------------------------------------------------------------------------
// Cold-start / process-restoration route validation
// ---------------------------------------------------------------------------

export type RestoredRoute = {
  readonly pathname: SafeInternalPath;
};

/** The route the app restores to whenever a persisted last-route can't be trusted. */
export const SAFE_DEFAULT_ROUTE: RestoredRoute = { pathname: '/explore' };

/**
 * Validates a persisted "last route" blob (as it would come back from disk/storage after a cold
 * start) and returns a route that is safe to restore into. Anything that isn't a well-formed
 * object with a `pathname` on the safe-route allowlist — including a stale entity id format that
 * used to be valid but no longer parses, a completely different shape, `null`/`undefined`, or a
 * prototype-pollution-shaped object — falls back to `SAFE_DEFAULT_ROUTE` (the Explore tab)
 * rather than ever being handed to the router unchecked or throwing.
 */
export function parseRestoredRoute(persisted: unknown): RestoredRoute {
  if (persisted === null || typeof persisted !== 'object') return SAFE_DEFAULT_ROUTE;

  const candidate = (persisted as Record<string, unknown>).pathname;
  if (!isSafeInternalPath(candidate)) return SAFE_DEFAULT_ROUTE;

  return { pathname: candidate };
}
