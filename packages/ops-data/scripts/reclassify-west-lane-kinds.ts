/**
 * repo-n7p6.24 — 14 `west_*` records were published as `kind='person'` but are parks, hotels,
 * buildings, a military unit, a law, and three history topics.
 *
 * How they were found, and how to find the next batch: for every active-release row with
 * `kind='person'` and a `bb_canonical.entity_identifiers` wikidata value, fetch
 * `Special:EntityData/{qid}.json` and check that P31 contains Q5 (human). None of the records
 * below do. Their QIDs are CORRECT — the Wikidata item genuinely is a park or a hotel; it is the
 * `kind` on our side that is wrong. That is why this script only rewrites `kind`, and never
 * touches identifiers.
 *
 * Each target kind is taken from the record's own P31, not guessed from its name:
 *   urban park / seaside resort / protected area / homestead / historic site / hotel / clubhouse /
 *   archaeological site  -> place
 *   military unit                                                                 -> organization
 *   (Oregon black exclusion laws: no P31, description "Law attempt of Oregon")     -> law
 *   aspect of history                                                             -> other
 *
 * `other` for the three "history of ..." rows is deliberate: the published kind vocabulary
 * (ENTITY_KINDS) has no `topic` member, and calling an overview article a place or an event would
 * be a second miscategorization. Whether encyclopedia-topic rows belong in the entity catalog at
 * all is a separate question, left open on the bead.
 *
 * The person-only status fields go too. These rows carried `status='unknown'` — a value from the
 * living/deceased/unknown vocabulary — which is meaningless on a hotel and was polluting
 * person-status accounting. They are removed rather than replaced: we have no evidence for a
 * place-status on these records, and inventing `active` or `historic` would be a guess.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/reclassify-west-lane-kinds.ts
 *
 * Apply:
 *   DRY_RUN=0 RECLASSIFY_WEST_LANE_KINDS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/reclassify-west-lane-kinds.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.RECLASSIFY_WEST_LANE_KINDS_APPLY === '1';

/** entity id -> corrected kind, with the P31 that decided it. */
export const RECLASSIFICATIONS: ReadonlyArray<{
  readonly entityId: string;
  readonly kind: 'place' | 'organization' | 'law' | 'other';
  readonly basis: string;
}> = [
  { entityId: 'west_black_panther_park_q139553357', kind: 'place', basis: 'Q22746 urban park' },
  {
    entityId: 'west_black_seminole_scouts_q4921811',
    kind: 'organization',
    basis: 'Q176799 military unit',
  },
  { entityId: 'west_bruce_s_beach_q106548590', kind: 'place', basis: 'Q1021711 seaside resort' },
  {
    entityId: 'west_colonel_allensworth_state_historic_park_q5148087',
    kind: 'place',
    basis: 'Q473972 protected area',
  },
  {
    entityId: 'west_george_washington_carver_homestead_site_q60755946',
    kind: 'place',
    basis: 'Q5890494 homestead / Q1081138 historic site',
  },
  {
    entityId: 'west_history_of_african_americans_in_kansas_q109621034',
    kind: 'other',
    basis: 'Q17524420 aspect of history',
  },
  {
    entityId: 'west_history_of_slavery_in_california_q5868820',
    kind: 'other',
    basis: 'Q17524420 aspect of history',
  },
  {
    entityId: 'west_history_of_slavery_in_colorado_q107073212',
    kind: 'other',
    basis: 'Q17524420 aspect of history',
  },
  {
    entityId: 'west_moulin_rouge_hotel_q6919006',
    kind: 'place',
    basis: 'Q27686 hotel / Q133215 casino',
  },
  {
    entityId: 'west_oregon_black_exclusion_laws_q39086930',
    kind: 'law',
    basis: 'no P31; description "Law attempt of Oregon"',
  },
  {
    entityId: 'west_quindaro_townsite_q7272207',
    kind: 'place',
    basis: 'Q839954 archaeological site / Q74047 ghost town',
  },
  { entityId: 'west_swindall_tourist_inn_q28153720', kind: 'place', basis: 'Q27686 hotel' },
  {
    entityId: 'west_topeka_council_of_colored_women_s_clubs_building_q58030644',
    kind: 'place',
    basis: 'Q1103285 clubhouse',
  },
  { entityId: 'west_winks_panorama_q8025498', kind: 'place', basis: 'Q27686 hotel' },
];

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const ids = RECLASSIFICATIONS.map((r) => r.entityId);
    const { rows: current } = await client.query<{
      entity_id: string;
      canonical_kind: string | null;
      release_kind: string | null;
      projection_kind: string | null;
      projection_status: string | null;
    }>(
      `SELECT re.entity_id,
              e.kind AS canonical_kind,
              re.kind AS release_kind,
              re.projection->>'kind' AS projection_kind,
              re.projection->>'status' AS projection_status
         FROM bb_public.release_entities re
         JOIN bb_public.v_active_release_id r ON r.release_id = re.release_id
         LEFT JOIN bb_canonical.entities e ON e.id = re.entity_id
        WHERE re.entity_id = ANY($1::text[])
        ORDER BY re.entity_id`,
      [ids],
    );

    console.log('=== Reclassify west_* lane kinds ===');
    const byId = new Map(RECLASSIFICATIONS.map((r) => [r.entityId, r]));
    for (const row of current) {
      const target = byId.get(row.entity_id);
      console.log(
        `  ${row.entity_id}\n    canonical=${row.canonical_kind ?? 'n/a'} release=${row.release_kind ?? 'n/a'} projection=${row.projection_kind ?? 'n/a'} status=${row.projection_status ?? 'none'} -> ${target?.kind} (${target?.basis})`,
      );
    }
    const missing = ids.filter((id) => !current.some((row) => row.entity_id === id));
    if (missing.length > 0) console.log(`\nNot in the active release: ${missing.join(', ')}`);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 RECLASSIFY_WEST_LANE_KINDS_APPLY=1 to apply.');
      return;
    }

    let canonical = 0;
    let release = 0;
    let search = 0;
    await client.query('BEGIN');
    try {
      for (const target of RECLASSIFICATIONS) {
        const c = await client.query(`UPDATE bb_canonical.entities SET kind = $2 WHERE id = $1`, [
          target.entityId,
          target.kind,
        ]);
        canonical += c.rowCount ?? 0;

        const e = await client.query(
          `UPDATE bb_public.release_entities re
              SET kind = $2,
                  projection = (
                    jsonb_set(re.projection, '{kind}', to_jsonb($2::text), true)
                    - 'status' - 'livingStatus' - 'statusProvenance' - 'statusHistory'
                  )
             FROM bb_public.v_active_release_id r
            WHERE re.release_id = r.release_id AND re.entity_id = $1`,
          [target.entityId, target.kind],
        );
        release += e.rowCount ?? 0;

        // The search doc is served from `facets` verbatim (see repo-n7p6.28), so it must be
        // rewritten alongside the column, not instead of it.
        const s = await client.query(
          `UPDATE bb_public.search_index si
              SET kind = $2,
                  status = NULL,
                  facets = CASE
                    WHEN jsonb_typeof(si.facets) = 'object'
                      THEN jsonb_set(si.facets, '{kind}', to_jsonb($2::text), true) - 'status'
                    ELSE si.facets
                  END
             FROM bb_public.v_active_release_id r
            WHERE si.release_id = r.release_id AND si.entity_id = $1`,
          [target.entityId, target.kind],
        );
        search += s.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log(
      `\nApplied: bb_canonical.entities=${canonical} release_entities=${release} search_index=${search}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
