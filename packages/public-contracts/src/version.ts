/**
 * Wire-contract version constants for `@black-book/public-contracts` (ADR-021 §2).
 *
 * - `API_VERSION` is the current major the server serves by default and the value this package's
 *   `v1/*` subpaths correspond to. When a breaking shape change ships, a sibling `v2/*` subpath
 *   tree is added here; `API_VERSION` becomes `'v2'`, and `v1/*` is kept (not deleted) for the
 *   deprecation window below.
 * - `MIN_SUPPORTED_API_VERSION` is the floor `apps/api-public` enforces against the
 *   `X-BlackStory-Client` request header (ADR-021 §2). A request below this floor gets
 *   `CLIENT_VERSION_UNSUPPORTED` / `426 Upgrade Required` (see `./errors.ts`).
 *
 * Deprecation window (ADR-021 §2 + "Red-team resolutions" #1): once a new major becomes default,
 * the immediately prior major is supported for a documented MINIMUM of `DEPRECATION_WINDOW_DAYS`
 * (90) days, and is never retired while store analytics (MOB-018) show a non-trivial installed
 * base still pinned to it. This constant is a floor, not a deadline — do not build logic that
 * deletes a deprecated major purely because this many days elapsed; retirement is always an
 * explicit, evidence-gated bead (ADR-021 migration triggers), never a timer.
 */
export const API_VERSION = 'v1' as const;
export const MIN_SUPPORTED_API_VERSION = 'v1' as const;
export const DEPRECATION_WINDOW_DAYS = 90 as const;

export type ApiVersion = typeof API_VERSION;

const KNOWN_API_VERSIONS = [API_VERSION] as const;

/** Structural guard used by `./v1/compatibility.ts` — kept here so the known-version list has a
 * single source of truth as future majors are added. */
export function isKnownApiVersion(value: string): value is ApiVersion {
  return (KNOWN_API_VERSIONS as readonly string[]).includes(value);
}
