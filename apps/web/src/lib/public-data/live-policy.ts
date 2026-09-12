/**
 * Policy for when the web app should attempt canonical Postgres public projection reads.
 *
 * Local dig footguns this module documents:
 * - `PUBLIC_DATA_SOURCE` unset + no `DATABASE_URL` → Dunbar seed (4 entities); national dig
 *   looks empty.
 * - `PUBLIC_DATA_SOURCE=postgres` without `DATABASE_URL` → empty catalog (seed refused).
 * Use `./scripts/dev-web.sh` (or set both vars) for the live ~1100-entity catalog.
 */

export type PublicDataSource = 'seed' | 'postgres';

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export function resolvePublicDataSource(
  env: EnvironmentLike = process.env,
): PublicDataSource | undefined {
  const raw = env.PUBLIC_DATA_SOURCE?.trim().toLowerCase();
  if (raw === 'seed' || raw === 'postgres') {
    return raw;
  }
  return undefined;
}

export function isPostgresPublicDataSource(env: EnvironmentLike = process.env): boolean {
  return resolvePublicDataSource(env) === 'postgres';
}

/**
 * Whether list/map/search may prefer ADR-004 CDN/local `entities.json` artifacts.
 *
 * Postgres stays the system of record for WHICH release is active: the active-release pointer
 * is always read live, and `release-artifacts.ts` rejects any artifact whose `releaseId`
 * doesn't match that pointer, so an artifact from a DIFFERENT (superseded) release can never
 * shadow `bb_public`. That is weaker than "a stale artifact can never shadow bb_public" — the
 * guard is identity-based, not content-based. Dozens of `packages/ops-data/scripts` fix/backfill
 * scripts upsert `bb_public.release_entities`/`search_index` under the SAME release id without
 * bumping the active-release pointer (repo-19mxs), so a pre-correction artifact and a
 * post-correction one carry an identical `releaseId` and the guard cannot tell them apart. The
 * CDN artifact catches up via `publish-release-catalog-artifacts.yml`, which is dispatched
 * manually right after such a script runs (each now prints a reminder — see
 * `remindToRepublishCatalogArtifacts`) or, failing that, by a once-daily forgetting-insurance
 * cron — so worst-case staleness on this path is bounded at roughly 24h, not zero. In postgres
 * mode artifacts are used only when an explicit origin (`APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL`)
 * is configured — they are the read-through cache that keeps multi-MB catalog pulls off the
 * database (Supabase egress audit 2026-08: cold-start catalog reads were the dominant
 * uncached-egress driver).
 */
export function shouldPreferReleaseArtifacts(env: EnvironmentLike = process.env): boolean {
  if (resolvePublicDataSource(env) !== 'postgres') {
    // Seed / unset still allow ADR-004 CDN/local entities.json as a read-through cache.
    return true;
  }
  const artifactOrigin = env.APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL?.trim();
  return Boolean(artifactOrigin && artifactOrigin.length > 0);
}

/** Server-only Postgres URL present (`DATABASE_URL` or `APP_DATABASE_URL`). */
export function hasPostgresConnection(env: EnvironmentLike = process.env): boolean {
  return Boolean(env.DATABASE_URL?.trim() || env.APP_DATABASE_URL?.trim());
}

/**
 * True when postgres SoR is selected but no connection string is configured — list/map/search
 * will return an empty catalog (never the Dunbar seed).
 */
export function isPostgresPublicDataMisconfigured(env: EnvironmentLike = process.env): boolean {
  return isPostgresPublicDataSource(env) && !hasPostgresConnection(env);
}

/** Whether this runtime should attempt live public projection reads.  */
export function shouldUseLivePublicProjections(env: EnvironmentLike = process.env): boolean {
  if (env.PUBLIC_DATA_SOURCE === 'seed') {
    return false;
  }
  return isPostgresPublicDataSource(env) && hasPostgresConnection(env);
}
