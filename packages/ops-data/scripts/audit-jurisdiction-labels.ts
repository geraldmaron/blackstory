/**
 * Read-only audit of country-only jurisdiction labels. Distinguishes wrong-grained labels from
 * missing labels such as Unknown so each defect remains measurable.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const COUNTRY_ONLY_PATTERN = /^(united states of america|united states|u\.s\.a\.|u\.s\.|usa)$/iu;

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** First underscore-delimited segment(s) that identify a lane, without over-splitting ids like `ent_authority_net_...`. */
function lanePrefix(entityId: string): string {
  const known = [
    'nrhp-black-heritage',
    'dc-black',
    'dc-sites',
    'us-ed',
    'negro-leagues',
    'sundown',
  ];
  for (const prefix of known) {
    if (entityId.startsWith(`${prefix}-`) || entityId.startsWith(`${prefix}_`)) return prefix;
  }
  const firstSegment = entityId.split(/[-_]/u)[0];
  return firstSegment ?? entityId;
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

    const rows = await client.query<{ entity_id: string; label: string | null }>(
      `SELECT entity_id, projection ->> 'jurisdictionLabel' AS label
       FROM published.release_entities
       WHERE release_id = $1`,
      [releaseId],
    );

    const offenders = rows.rows.filter(
      (row) => row.label !== null && COUNTRY_ONLY_PATTERN.test(row.label.trim()),
    );

    console.log(`=== jurisdiction-label audit (release ${releaseId}) ===`);
    console.log(`${rows.rows.length} live entities checked, ${offenders.length} country-only\n`);

    if (offenders.length === 0) {
      console.log('Clean — no entity publishes a country-only jurisdictionLabel.');
      return;
    }

    const byLane = new Map<string, number>();
    for (const row of offenders) {
      const lane = lanePrefix(row.entity_id);
      byLane.set(lane, (byLane.get(lane) ?? 0) + 1);
    }
    console.log('By lane:');
    for (const [lane, count] of [...byLane.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${lane}: ${count}`);
    }

    if (offenders.length <= 20) {
      console.log('\nAll offenders:');
      for (const row of offenders) console.log(`  ${row.entity_id}: "${row.label}"`);
    } else {
      console.log('\nFirst 20 offenders:');
      for (const row of offenders.slice(0, 20)) console.log(`  ${row.entity_id}: "${row.label}"`);
    }

    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
