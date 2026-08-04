/**
 * Expand verb helpers: resolve a canonical entity seed and optionally stage Wikidata network candidates.
 */
import {
  expandEntityNetwork,
  stageNetworkCandidates,
  type EntityKindForExpansion,
  type ExpansionSeed,
} from './entity-network-expansion.js';

type QueryResult<T> = { readonly rows: readonly T[]; readonly rowCount?: number | null };
type Queryable = {
  query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
};
type PoolClient = Queryable & { release(): void };
type Pool = Queryable & { connect(): Promise<PoolClient> };

type CanonicalEntityRow = {
  readonly id: string;
  readonly kind: string;
  readonly display_name: string;
  readonly identifiers: unknown;
};

function extractWikidataQid(identifiers: unknown): string | undefined {
  if (Array.isArray(identifiers)) {
    for (const entry of identifiers) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const system = typeof record.system === 'string' ? record.system.toLowerCase() : '';
      const namespace = typeof record.namespace === 'string' ? record.namespace.toLowerCase() : '';
      const value = typeof record.value === 'string' ? record.value.trim() : '';
      if ((system === 'wikidata' || namespace === 'wikidata') && /^Q\d+$/u.test(value)) {
        return value;
      }
    }
    return undefined;
  }
  if (identifiers && typeof identifiers === 'object') {
    const record = identifiers as Record<string, unknown>;
    const direct = record.wikidata;
    if (typeof direct === 'string' && /^Q\d+$/u.test(direct.trim())) {
      return direct.trim();
    }
  }
  return undefined;
}

function mapExpansionKind(kind: string): EntityKindForExpansion {
  if (kind === 'person') return 'person';
  if (kind === 'organization' || kind === 'movement') return 'organization';
  if (kind === 'institution' || kind === 'school') return 'institution';
  return 'other';
}

export async function loadExpansionSeed(pool: Pool, entityId: string): Promise<ExpansionSeed> {
  const { rows } = await pool.query<CanonicalEntityRow>(
    `SELECT id, kind, display_name, identifiers
       FROM bb_canonical.entities
      WHERE id = $1`,
    [entityId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Entity not found: ${entityId}`);
  }
  const qid = extractWikidataQid(row.identifiers);
  if (!qid) {
    throw new Error(`Entity ${entityId} has no Wikidata QID in identifiers`);
  }
  return {
    entityId: row.id,
    qid,
    kind: mapExpansionKind(row.kind),
    displayName: row.display_name,
  };
}

export async function insertLandscapeCandidateRows(
  client: Pool | PoolClient,
  rows: readonly {
    readonly id: string;
    readonly run_id: string;
    readonly lane: string;
    readonly source_program_id: string;
    readonly source_item_id: string;
    readonly display_name: string;
    readonly kind: string;
    readonly summary: string;
    readonly canonical_url: string;
    readonly status: string;
    readonly provenance: unknown;
    readonly payload: unknown;
    readonly discovered_at: string;
  }[],
): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    const result = await client.query(
      `INSERT INTO bb_research.landscape_candidates
        (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
         canonical_url, research_lane_only, status, payload, provenance, discovered_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11::jsonb,$12::jsonb,$13,now())
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.run_id,
        row.lane,
        row.source_program_id,
        row.source_item_id,
        row.display_name,
        row.kind,
        row.summary,
        row.canonical_url,
        row.status,
        JSON.stringify(row.payload),
        JSON.stringify(row.provenance),
        row.discovered_at,
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

export async function ensureSourceProgramRun(
  client: Pool | PoolClient,
  runId: string,
  sourceProgramId: string,
  sourceProgramName: string,
  summary: Record<string, unknown>,
  candidateCount: number,
  lane: 'wikidata' | 'other' = 'wikidata',
): Promise<void> {
  await client.query(
    `INSERT INTO bb_research.source_program_runs
      (id, lane, source_program_id, source_program_name, retrieved_at, rows_fetched, candidate_count, summary, updated_at)
     VALUES ($1, $2, $3, $4, now(), $5, $6, $7::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET
       candidate_count = EXCLUDED.candidate_count,
       summary = EXCLUDED.summary,
       updated_at = now()`,
    [
      runId,
      lane,
      sourceProgramId,
      sourceProgramName,
      candidateCount,
      candidateCount,
      JSON.stringify(summary),
    ],
  );
}

export { expandEntityNetwork, stageNetworkCandidates };
