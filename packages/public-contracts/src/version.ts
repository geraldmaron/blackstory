/**
 * Wire-contract version constants for `@repo/public-contracts` (`docs/decisions-carryover.md`,
 * "ADR-021's two invariants": app/API compatibility).
 *
 * - `API_VERSION` is the current major the server serves by default and the value this package's
 *   `v1/*` subpaths correspond to. When a breaking shape change ships, a sibling `v2/*` subpath
 *   tree is added here; `API_VERSION` becomes `'v2'`, and `v1/*` is kept (not deleted) for the
 *   deprecation window below.
 * - `MIN_SUPPORTED_API_VERSION` is the floor `apps/api-public` enforces against the
 *   `X-BlackStory-Client` request header. A request below this floor gets
 *   `CLIENT_VERSION_UNSUPPORTED` / `426 Upgrade Required` (see `./errors.ts`).
 *
 * Deprecation window: once a new major becomes default, the immediately prior major is supported
 * for a documented MINIMUM of `DEPRECATION_WINDOW_DAYS` (90) days, and is never retired while
 * store analytics (MOB-018) show a non-trivial installed base still pinned to it. Nothing reads
 * this constant to retire anything — `evaluateCompatibility` only echoes it into the
 * `/v1/compatibility` body — so it is a floor a human keeps, not a deadline any code enforces. Do
 * not build logic that deletes a deprecated major purely because this many days elapsed;
 * retirement is always an explicit, evidence-gated bead, never a timer
 * (`docs/decisions-carryover.md`, "ADR-021's two invariants": the deprecation window).
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
