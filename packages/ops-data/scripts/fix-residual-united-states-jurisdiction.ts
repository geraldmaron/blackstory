/**
 * repo-2t04.2 — the 11 live, non-NRHP records whose jurisdictionLabel is the bare fallback
 * "United States" (repo-tjqn's bug is the 2,550-record NRHP lane; this is everything else).
 *
 * The obvious automated fix — deriving a state from the entity's own lat/lng via
 * findUsStateForPoint (packages/domain/src/map/us-geography.ts) — was tried first and rejected:
 * that lookup is bbox-based, and testing it against these 11 coordinates got 3 of 8 places WRONG
 * (Contrabands and Freedmen Cemetery: bbox says DC, the record's own cited source says Alexandria,
 * Virginia; Rye African-American Cemetery: bbox says Connecticut, the record's own cited source
 * says Rye, New York; Shelley House: bbox says Illinois, the record's own cited source says St.
 * Louis, Missouri). All three sit near a state border, which is exactly where a bbox test is
 * unreliable — the function's own doc comment already says "bbox attribution is not curated".
 * Blindly automating this fix would have introduced new inaccuracies into the same initiative
 * meant to remove them.
 *
 * Every label below instead comes from the record's OWN existing high-confidence claim and
 * citation (state historic registries, NPS, town government, The Heritage Society) — already
 * live on the record, just never surfaced into jurisdictionLabel. The 3 laws are pinned at the
 * U.S. Capitol (unambiguous DC coordinates, no border issue) and get "Washington, District of
 * Columbia" as the site of federal enactment, per the bead's own guidance to say a federal scope
 * deliberately rather than fall back silently.
 *
 * CAVEAT: jurisdictionLabel on these ent_ and gap_ prefixed curated records has no upstream source (no
 * canonical `place` column — see bb_canonical.entities schema) other than whatever import/seed
 * script originally wrote "United States" as a placeholder. This script fixes the live
 * bb_public.release_entities projection; it does not find or fix that upstream seed, so a full
 * corpus rebuild-from-canonical could regress these back to "United States" if it re-derives
 * jurisdictionLabel the same way. Flagged, not fixed here — out of this bead's scope.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-residual-united-states-jurisdiction.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_RESIDUAL_JURISDICTION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-residual-united-states-jurisdiction.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_RESIDUAL_JURISDICTION_APPLY === '1';

const CORRECTIONS: ReadonlyArray<{
  readonly entityId: string;
  readonly label: string;
  /** Where this label came from, for the dry-run/apply log. */
  readonly source: string;
}> = [
  {
    entityId: 'ent_law_anti_drug_abuse_act_1986',
    label: 'Washington, District of Columbia',
    source: 'federal enactment site (U.S. Capitol coordinates, unambiguous)',
  },
  {
    entityId: 'ent_law_fair_sentencing_act_2010',
    label: 'Washington, District of Columbia',
    source: 'federal enactment site (U.S. Capitol coordinates, unambiguous)',
  },
  {
    entityId: 'gap_1890_land',
    label: 'Washington, District of Columbia',
    source: 'federal enactment site (U.S. Capitol coordinates, unambiguous)',
  },
  {
    entityId: 'ent_authority_net_20260723_abraham_hall',
    label: 'Rossville, Maryland',
    source: 'own claim + apps.mht.maryland.gov citation',
  },
  {
    entityId: 'ent_authority_net_20260723_charlies_place',
    label: 'Myrtle Beach, South Carolina',
    source: 'own claim + nps.gov citation',
  },
  {
    entityId: 'ent_authority_net_20260723_contrabands_freedmen_cemetery',
    label: 'Alexandria, Virginia',
    source: 'own claim + dhr.virginia.gov citation (bbox lookup wrongly said DC)',
  },
  {
    entityId: 'ent_authority_net_20260723_historic_west_hunter_street_baptist_church',
    label: 'Atlanta, Georgia',
    source: 'own claim + nps.gov citation',
  },
  {
    entityId: 'ent_authority_net_20260723_rye_african_american_cemetery',
    label: 'Rye, New York',
    source: 'own claim + ryetownny.gov citation (bbox lookup wrongly said Connecticut)',
  },
  {
    entityId: 'ent_authority_net_20260723_shelley_house',
    label: 'St. Louis, Missouri',
    source: 'own claim + nps.gov citation (bbox lookup wrongly said Illinois)',
  },
  {
    entityId: 'ent_authority_net_20260723_tenth_street_historic_district',
    label: 'Dallas, Texas',
    source: 'own claim + loc.gov citation',
  },
  {
    entityId: 'ent_authority_net_20260723_yates_house',
    label: 'Houston, Texas',
    source: 'own claim + heritagesociety.org citation',
  },
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
    const releaseId = (
      await client.query<{ release_id: string }>(
        `SELECT release_id FROM bb_public.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    console.log(`=== residual 'United States' jurisdiction fix (release ${releaseId}) ===\n`);

    const current = await client.query<{ entity_id: string; label: string | null }>(
      `SELECT entity_id, projection ->> 'jurisdictionLabel' AS label
       FROM bb_public.release_entities
       WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
      [releaseId, CORRECTIONS.map((c) => c.entityId)],
    );
    const currentById = new Map(current.rows.map((row) => [row.entity_id, row.label]));

    const toFix = CORRECTIONS.filter((c) => currentById.get(c.entityId) === 'United States');
    const alreadyFixed = CORRECTIONS.filter((c) => currentById.get(c.entityId) !== 'United States');
    const missing = CORRECTIONS.filter((c) => !currentById.has(c.entityId));

    for (const c of toFix) {
      console.log(`  ${c.entityId}: "United States" -> "${c.label}" (${c.source})`);
    }
    if (alreadyFixed.length > 0) {
      console.log(
        `\n${alreadyFixed.length} already not "United States" (skipping): ` +
          alreadyFixed.map((c) => `${c.entityId}="${currentById.get(c.entityId)}"`).join(', '),
      );
    }
    if (missing.length > 0) {
      console.log(
        `\n${missing.length} not found in the active release (skipping): ` +
          missing.map((c) => c.entityId).join(', '),
      );
    }

    if (toFix.length === 0) {
      console.log('\nNothing to apply.');
      return;
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        `\nDRY_RUN=1 (default): ${toFix.length} row(s) would be updated. ` +
          'Set DRY_RUN=0 FIX_RESIDUAL_JURISDICTION_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      for (const c of toFix) {
        await client.query(
          `UPDATE bb_public.release_entities
             SET projection = jsonb_set(projection, '{jurisdictionLabel}', to_jsonb($3::text))
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, c.entityId, c.label],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await client.query<{ entity_id: string; label: string | null }>(
      `SELECT entity_id, projection ->> 'jurisdictionLabel' AS label
       FROM bb_public.release_entities
       WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
      [releaseId, toFix.map((c) => c.entityId)],
    );
    console.log(`\nApplied ${after.rows.length} update(s):`);
    for (const row of after.rows) console.log(`  ${row.entity_id}: "${row.label}"`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
