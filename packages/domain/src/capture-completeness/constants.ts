/**
 * Named thresholds for the capture-completeness ops bar: the minimum share of published web
 * citations that must carry an archived capture pointer before BlackStory markets a queryable
 * API surface. See `docs/research/capture-completeness-ops-bar.md` for measurement SQL and
 * budgeted Save Page Now guidance.
 */

/** Wire/version token for dashboards and release preflight logs. */
export const CAPTURE_COMPLETENESS_OPS_BAR_VERSION = 'capture-completeness-ops.v1' as const;

/**
 * Minimum ratio of web citations with an archived capture (Wayback URL or content-addressed
 * `source_captures` row). Aligns with gold-corpus quality gates (~95%) and gates PostgREST /
 * developer-surface marketing alongside geo-integrity (see landscape intake).
 */
export const CAPTURE_COMPLETENESS_BAR_RATIO = 0.95;

/**
 * Daily `source_fetch` budget reference for ops planning — mirrors
 * `@repo/security` `DEFAULT_DAILY_BUDGETS.source_fetch.dailyCap`. Each Wayback SPN attempt
 * typically consumes multiple fetch units (submit + status polls); backfill plans must stay
 * under soft-shutdown (80%) and hard-stop (100%) thresholds documented in the ops memo.
 */
export const CAPTURE_COMPLETENESS_SOURCE_FETCH_DAILY_CAP = 2_000 as const;
