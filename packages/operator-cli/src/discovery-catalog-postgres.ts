/**
 * Loads active canonical entities from Postgres as discovery `ResolutionProfile[]`.
 *
 * `bb_public.search_index` is the read-side catalog of active-release entities — Firestore's
 * `publicSearchIndex` is retired (see `packages/migrate-firestore-postgres/README.md`, "leftover,
 * not a current write target"). This is the discovery-match counterpart to
 * `loadEditorialCatalogFromPostgres` in this same package: same pool, same table, mapped to the
 * resolver's shape instead of the embedding shape.
 *
 * Soft match only, same contract as `attachCatalogMatch` (`@repo/domain`) — never hard-excludes a
 * discovery candidate just because a name overlaps an entry here.
 */
import { isEntityKind, type ResolutionProfile } from '@repo/domain';
import { getOpsPostgresPool } from '@repo/data-access';

export const DISCOVERY_CATALOG_POSTGRES_DEFAULT_MAX = 5_000 as const;
const DISCOVERY_CATALOG_POSTGRES_HARD_CAP = 10_000 as const;

/** Minimal query surface this module needs — satisfied by the pool `getOpsPostgresPool` returns. */
export type DiscoveryCatalogQueryable = Pick<ReturnType<typeof getOpsPostgresPool>, 'query'>;

export type SearchIndexCatalogRow = {
  readonly entity_id: string | null;
  readonly name: string | null;
  readonly kind: string | null;
  readonly aliases: readonly string[] | null;
};

/** Parameterized SQL for the active-release page discovery catalog matching reads. */
export function buildDiscoveryCatalogQuery(input: { readonly limit: number }): {
  readonly sql: string;
  readonly params: readonly unknown[];
} {
  return {
    sql: `
      SELECT si.entity_id, si.name, si.kind, si.aliases
      FROM bb_public.search_index si
      JOIN bb_public.v_active_release_id v ON v.release_id = si.release_id
      WHERE si.entity_id IS NOT NULL
      ORDER BY si.entity_id
      LIMIT $1
    `,
    params: [input.limit],
  };
}

/** Map one `search_index` row into a discovery `ResolutionProfile`, or undefined if unusable. */
export function resolutionProfileFromSearchIndexRow(
  row: SearchIndexCatalogRow,
  nowIso: string,
): ResolutionProfile | undefined {
  if (!row.entity_id || !row.name || !row.kind || !isEntityKind(row.kind)) {
    return undefined;
  }
  const aliasValues = (row.aliases ?? []).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return {
    entity: {
      id: row.entity_id,
      kind: row.kind,
      displayName: row.name,
      ...(aliasValues.length > 0
        ? { aliases: aliasValues.map((value) => ({ value, kind: 'aka' as const })) }
        : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

export type LoadDiscoveryCatalogProfilesFromPostgresOptions = {
  readonly maxProfiles?: number;
  readonly nowIso?: string;
  readonly pool?: DiscoveryCatalogQueryable;
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

/**
 * Loads active canonical entities from `bb_public.search_index` as discovery
 * `ResolutionProfile[]`, for `catalogProfiles` on `dispatchDiscoveryCampaign`
 * (`@repo/config/scheduled-jobs`).
 */
export async function loadDiscoveryCatalogProfilesFromPostgres(
  options: LoadDiscoveryCatalogProfilesFromPostgresOptions = {},
): Promise<readonly ResolutionProfile[]> {
  const maxProfiles = Math.min(
    DISCOVERY_CATALOG_POSTGRES_HARD_CAP,
    Math.max(1, options.maxProfiles ?? DISCOVERY_CATALOG_POSTGRES_DEFAULT_MAX),
  );
  const nowIso = options.nowIso ?? new Date().toISOString();
  const pool = options.pool ?? getOpsPostgresPool(options.environment ?? process.env);
  const { sql, params } = buildDiscoveryCatalogQuery({ limit: maxProfiles });
  const result = await pool.query<SearchIndexCatalogRow>(sql, params as unknown[]);

  const profiles: ResolutionProfile[] = [];
  for (const row of result.rows) {
    const profile = resolutionProfileFromSearchIndexRow(row, nowIso);
    if (profile !== undefined) {
      profiles.push(profile);
    }
  }
  return profiles;
}
