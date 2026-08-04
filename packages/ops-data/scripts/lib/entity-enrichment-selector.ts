/**
 * Selector for the entity-depth enrichment ledger (bb_research.entity_enrichment,
 * repo-n7p6.2 / WS2). Every later enrichment pass (WS3 evidence sweep, WS4 cheap-model
 * harness) imports this to decide which active-release entities still need work, so a
 * re-run is resumable: skip anything already freshly enriched, but always re-include
 * anything missing a field the harness is supposed to fill in, and support
 * "re-enrich anything older than N days".
 *
 * Two layers, per the ledger's idempotency rule (unchanged evidence_digest + fresh
 * last_enriched_at => skip):
 *   1. `buildEnrichmentSelectorQuery` / `selectEntitiesForEnrichment` — the coarse SQL
 *      pass. Cheap: runs before any evidence fetch, so it can only reason about
 *      timestamps and the projection actually published today.
 *   2. `evaluateEnrichmentCandidacy` — a pure, DB-free re-check a harness runs after it
 *      has fetched fresh evidence and computed a digest for it, to avoid writing (and
 *      paying for an LLM call) when nothing actually changed since the last pass.
 */
import type pg from 'pg';

export const DEFAULT_STALE_DAYS = 30;

export type EntityEnrichmentSelectorParams = {
  /** Re-include entities last enriched more than this many days ago. Default 30. */
  readonly staleDays?: number;
  /**
   * Public-projection field names (e.g. 'historicalContext', 'topicIds', 'eraBuckets' —
   * see packages/schemas/src/public-projections.ts publicEntityProjectionSchema) to treat
   * as required. An entity missing any one of these in its current release projection is
   * included regardless of how recently it was enriched.
   */
  readonly missingFields?: readonly string[];
  /**
   * Restrict to these bb_research.landscape_candidates.lane values (joined on
   * landscape_candidates.id = release_entities.entity_id — the same id space; see the
   * entity_enrichment migration comment for why). Curated entities that were never
   * landscape-imported (ent_, recon_, gap_ prefixed ids) have no lane and are excluded
   * whenever this filter is supplied, so leave it empty to sweep everything.
   */
  readonly lanes?: readonly string[];
};

export type BuiltEnrichmentSelectorQuery = {
  readonly sql: string;
  readonly params: readonly unknown[];
};

/**
 * True (as a SQL fragment) when `re.projection -> $N` is absent, an empty/blank string,
 * or an empty array — the three shapes an unfilled optional projection field can take.
 * Parameterized on the field name so no field-name string is ever concatenated into SQL.
 */
function missingFieldClause(paramIndex: number): string {
  const ref = `re.projection -> $${paramIndex}::text`;
  const textRef = `re.projection ->> $${paramIndex}::text`;
  return `(
      (${ref}) IS NULL
      OR (jsonb_typeof(${ref}) = 'string' AND btrim(${textRef}) = '')
      OR (jsonb_typeof(${ref}) = 'array' AND jsonb_array_length(${ref}) = 0)
    )`;
}

/**
 * Pure SQL-predicate builder — no I/O, so it is unit-testable without a live DB. Selects
 * bb_public.release_entities.entity_id for the active release where the entity was never
 * enriched, is missing a requested field, or was last enriched further back than
 * staleDays. `lanes`, when non-empty, additionally restricts to matching
 * landscape_candidates.lane.
 */
export function buildEnrichmentSelectorQuery(
  params: EntityEnrichmentSelectorParams,
): BuiltEnrichmentSelectorQuery {
  const staleDays = params.staleDays ?? DEFAULT_STALE_DAYS;
  const missingFields = params.missingFields ?? [];
  const lanes = params.lanes ?? [];

  const queryParams: unknown[] = [];
  const missingFieldClauses: string[] = [];
  for (const field of missingFields) {
    queryParams.push(field);
    missingFieldClauses.push(missingFieldClause(queryParams.length));
  }

  queryParams.push(staleDays);
  const staleDaysParamIndex = queryParams.length;

  const inclusionReasons = [
    'ee.entity_id IS NULL',
    'ee.last_enriched_at IS NULL',
    `ee.last_enriched_at < now() - make_interval(days => $${staleDaysParamIndex}::int)`,
    ...missingFieldClauses,
  ];

  let laneClause = '';
  if (lanes.length > 0) {
    queryParams.push(lanes);
    laneClause = `\n      AND lc.lane = ANY($${queryParams.length}::text[])`;
  }

  const sql = `
    WITH active AS (
      SELECT release_id FROM bb_public.active_release WHERE id = 'active'
    )
    SELECT re.entity_id
    FROM bb_public.release_entities re
    JOIN active a ON re.release_id = a.release_id
    LEFT JOIN bb_research.entity_enrichment ee ON ee.entity_id = re.entity_id
    LEFT JOIN bb_research.landscape_candidates lc ON lc.id = re.entity_id
    WHERE (
      ${inclusionReasons.join('\n      OR ')}
    )${laneClause}
    ORDER BY re.entity_id
  `;

  return { sql, params: queryParams };
}

/** Minimal query surface this module needs — satisfied by `pg.Pool` and `pg.Client`. */
export type EnrichmentSelectorQueryable = Pick<pg.Pool, 'query'>;

/** Thin DB-calling wrapper around `buildEnrichmentSelectorQuery`. */
export async function selectEntitiesForEnrichment(
  db: EnrichmentSelectorQueryable,
  params: EntityEnrichmentSelectorParams,
): Promise<string[]> {
  const { sql, params: sqlParams } = buildEnrichmentSelectorQuery(params);
  const result = await db.query<{ entity_id: string }>(sql, sqlParams as unknown[]);
  return result.rows.map((row) => row.entity_id);
}

export type EnrichmentLedgerSnapshot = {
  readonly lastEnrichedAt: string | null;
  readonly evidenceDigest: string | null;
};

export type EnrichmentCandidacyReason =
  'never_enriched' | 'missing_field' | 'stale' | 'unchanged_evidence_fresh' | 'fresh';

export type EnrichmentCandidacyResult = {
  readonly include: boolean;
  readonly reason: EnrichmentCandidacyReason;
};

export type EnrichmentCandidacyInput = {
  /** The entity's current ledger row, or `null`/undefined if it has never been enriched. */
  readonly ledger?: EnrichmentLedgerSnapshot | null;
  /** True when the entity is missing one of the harness's requested fields right now. */
  readonly missingRequestedField?: boolean;
  /**
   * Digest of the evidence bundle the caller just fetched for this pass, if it has
   * already done that fetch. Only meaningful once evidence has actually been pulled —
   * omit it to fall back to freshness-only skip logic (what the SQL selector above does).
   */
  readonly freshEvidenceDigest?: string | null;
  readonly staleDays?: number;
  readonly now?: Date;
};

/**
 * Pure re-check for a harness that has already fetched evidence for one entity and wants
 * to decide whether to spend a write (and, for WS4, an LLM call) on it. No DB access —
 * every input is a value the caller already has in hand.
 */
export function evaluateEnrichmentCandidacy(
  input: EnrichmentCandidacyInput,
): EnrichmentCandidacyResult {
  const staleDays = input.staleDays ?? DEFAULT_STALE_DAYS;

  if (!input.ledger || input.ledger.lastEnrichedAt === null) {
    return { include: true, reason: 'never_enriched' };
  }
  if (input.missingRequestedField) {
    return { include: true, reason: 'missing_field' };
  }

  const now = input.now ?? new Date();
  const lastEnrichedAt = new Date(input.ledger.lastEnrichedAt);
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const isStale = now.getTime() - lastEnrichedAt.getTime() >= staleMs;
  if (isStale) {
    return { include: true, reason: 'stale' };
  }

  if (
    input.freshEvidenceDigest !== undefined &&
    input.freshEvidenceDigest !== null &&
    input.freshEvidenceDigest === input.ledger.evidenceDigest
  ) {
    return { include: false, reason: 'unchanged_evidence_fresh' };
  }
  return { include: false, reason: 'fresh' };
}
