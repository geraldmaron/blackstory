/**
 * Replaces broad jurisdiction labels using each record's cited location evidence. Bounding-box
 * state attribution is unreliable near borders and must not override a sourced label. Federal
 * enactment location is distinct from nationwide legal scope.
 */
import pg from 'pg';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
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
        `SELECT release_id FROM published.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    console.log(`=== residual 'United States' jurisdiction fix (release ${releaseId}) ===\n`);

    const current = await client.query<{ entity_id: string; label: string | null }>(
      `SELECT entity_id, projection ->> 'jurisdictionLabel' AS label
       FROM published.release_entities
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
          `UPDATE published.release_entities
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
       FROM published.release_entities
       WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
      [releaseId, toFix.map((c) => c.entityId)],
    );
    console.log(`\nApplied ${after.rows.length} update(s):`);
    for (const row of after.rows) console.log(`  ${row.entity_id}: "${row.label}"`);
    remindToRepublishCatalogArtifacts(after.rows.length);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
