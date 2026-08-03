/**
 * Stage regex text-mined person death-year signals into bb_research.landscape_candidates
 * (lane living-status-review). Never writes bb_canonical.living_status.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/stage-text-mined-death-review.ts
 *
 * Apply inserts:
 *   DRY_RUN=0 STAGE_TEXT_MINED_DEATH_REVIEW_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/stage-text-mined-death-review.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { mineTextForDeathYear, type TextMinedDeathHit } from './lib/text-mined-death.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.STAGE_TEXT_MINED_DEATH_REVIEW_APPLY === '1';
const LANE = 'living-status-review' as const;
const PROGRAM_ID = 'text-mined-death-review' as const;

type PersonRow = {
  readonly id: string;
  readonly display_name: string;
  readonly living_status: string;
  readonly summary: string | null;
  readonly historical_context: string | null;
};

type ClaimTextRow = {
  readonly entity_id: string;
  readonly predicate: string;
  readonly object: string;
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function buildLandscapeRow(
  hit: TextMinedDeathHit,
  person: PersonRow,
  runId: string,
  nowIso: string,
) {
  return {
    id: hit.entityId,
    run_id: runId,
    lane: LANE,
    source_program_id: PROGRAM_ID,
    source_item_id: hit.entityId,
    display_name: person.display_name,
    kind: 'person',
    summary: `Text-mined deceased signal (${hit.signal}, ${hit.deathYear}): ${hit.quote.slice(0, 180)}`,
    canonical_url: '',
    status: 'pending',
    provenance: {
      signal: hit.signal,
      quote: hit.quote,
      source: 'text_mined_death_review',
    },
    payload: {
      entityId: hit.entityId,
      personReview: {
        livingStatus: 'deceased' as const,
        deathYear: hit.deathYear,
        signal: hit.signal,
        approved: false,
      },
      ...(hit.birthYear !== undefined ? { birthYear: hit.birthYear } : {}),
      deathYear: hit.deathYear,
    },
    discovered_at: nowIso,
  };
}

async function loadUnknownPersons(client: pg.Client): Promise<PersonRow[]> {
  const { rows } = await client.query<PersonRow>(
    `SELECT
       e.id,
       e.display_name,
       e.living_status,
       coalesce(re.projection->>'summary', '') AS summary,
       coalesce(re.projection->>'historicalContext', '') AS historical_context
     FROM bb_canonical.entities e
     LEFT JOIN bb_public.active_release ar ON true
     LEFT JOIN bb_public.release_entities re
       ON re.entity_id = e.id AND re.release_id = ar.release_id
     WHERE e.kind = 'person'
       AND e.living_status = 'unknown'
       AND e.living_status IS DISTINCT FROM 'deceased'
     ORDER BY e.id`,
  );
  return rows;
}

async function loadClaimTextByEntity(client: pg.Client): Promise<Map<string, string>> {
  const { rows } = await client.query<ClaimTextRow>(
    `SELECT c.entity_id, v.predicate, coalesce(v.object::text, '') AS object
     FROM bb_canonical.claims c
     JOIN bb_canonical.claim_versions v ON v.id = c.current_version_id
     JOIN bb_canonical.entities e ON e.id = c.entity_id
     WHERE e.kind = 'person'
       AND e.living_status = 'unknown'
       AND c.current_version_id IS NOT NULL`,
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.entity_id) ?? [];
    list.push(`${row.predicate} ${row.object}`.trim());
    map.set(row.entity_id, list);
  }
  const joined = new Map<string, string>();
  for (const [entityId, parts] of map.entries()) {
    joined.set(entityId, parts.join(' '));
  }
  return joined;
}

export function minePersonDeathHit(
  person: PersonRow,
  claimText: string | undefined,
  asOfYear: number = new Date().getUTCFullYear(),
): TextMinedDeathHit | null {
  const summary = person.summary?.trim() ?? '';
  const historicalContext = person.historical_context?.trim() ?? '';
  const fromRelease = mineTextForDeathYear(person.id, summary, historicalContext, asOfYear);
  if (fromRelease) return fromRelease;
  if (!claimText?.trim()) return null;
  return mineTextForDeathYear(person.id, claimText, undefined, asOfYear);
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const persons = await loadUnknownPersons(client);
    const claimTextByEntity = await loadClaimTextByEntity(client);
    const runId = `run_text_mined_death_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const nowIso = new Date().toISOString();

    const hits: TextMinedDeathHit[] = [];
    for (const person of persons) {
      const hit = minePersonDeathHit(person, claimTextByEntity.get(person.id));
      if (hit) hits.push(hit);
    }

    console.log('=== Stage text-mined death review ===');
    console.log(`Unknown persons scanned: ${persons.length}`);
    console.log(`Text-mined death hits:   ${hits.length}`);
    for (const hit of hits.slice(0, 20)) {
      const person = persons.find((p) => p.id === hit.entityId);
      console.log(
        `  ${hit.entityId} (${person?.display_name ?? 'unknown'}): ${hit.signal} ${hit.deathYear} — ${hit.quote.slice(0, 100)}`,
      );
    }
    if (hits.length > 20) {
      console.log(`  ...and ${hits.length - 20} more`);
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no inserts. Set DRY_RUN=0 STAGE_TEXT_MINED_DEATH_REVIEW_APPLY=1 to apply.',
      );
      return;
    }

    let inserted = 0;
    await client.query('BEGIN');
    try {
      // landscape_candidates.run_id FK → source_program_runs; lane CHECK only allows catalog lanes.
      await client.query(
        `INSERT INTO bb_research.source_program_runs
          (id, lane, source_program_id, source_program_name, retrieved_at, rows_fetched, candidate_count, summary, updated_at)
         VALUES ($1, 'other', $2, $3, now(), $4, $4, $5::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           rows_fetched = EXCLUDED.rows_fetched,
           candidate_count = EXCLUDED.candidate_count,
           summary = EXCLUDED.summary,
           updated_at = now()`,
        [
          runId,
          PROGRAM_ID,
          'Text-mined person death review',
          hits.length,
          JSON.stringify({ lane: LANE, reason: 'text_mined_death_signal' }),
        ],
      );

      for (const hit of hits) {
        const person = persons.find((p) => p.id === hit.entityId);
        if (!person) continue;
        const row = buildLandscapeRow(hit, person, runId, nowIso);
        const landscapeId = `landcand_text_mined_death_${hit.entityId}`
          .replace(/[^a-zA-Z0-9_]+/g, '_')
          .slice(0, 180);
        const result = await client.query(
          `INSERT INTO bb_research.landscape_candidates
            (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
             canonical_url, research_lane_only, status, payload, provenance, discovered_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11::jsonb,$12::jsonb,$13,now())
           ON CONFLICT (lane, source_item_id) DO UPDATE SET
             run_id = EXCLUDED.run_id,
             summary = EXCLUDED.summary,
             payload = EXCLUDED.payload,
             provenance = EXCLUDED.provenance,
             updated_at = now()
           WHERE bb_research.landscape_candidates.payload->'personReview'->>'approved' IS DISTINCT FROM 'true'`,
          [
            landscapeId,
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
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log(`\nApplied: upserted ${inserted} landscape_candidates rows (lane=${LANE}).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
