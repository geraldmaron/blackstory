/**
 * Apply the sweep's Wikipedia anchor rule (lib/wikipedia-anchor.ts) to evidence captured before
 * the rule existed. Only evidence on PENDING candidates is touched: it is what future drafts read.
 * Evidence on live records is reported, not changed. Dry run unless --apply.
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   DATABASE_URL="$ADMIN_DATABASE_URL" node --conditions development --import tsx \
 *     packages/ops-data/scripts/quarantine-unanchored-wikipedia.ts [--apply]
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { wikipediaPageAnchored } from './lib/wikipedia-anchor.ts';

const REASON =
  "Wikipedia page found by name, not the record's linked article or a page matching its place";

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (the admin login)');
  const client = new pg.Client(normalizePgConnectionString(databaseUrl));
  await client.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      lc_status: string;
      source_url: string;
      display_name: string;
      canonical: string | null;
      identity: { placeKnown?: boolean; placeCorroborated?: boolean } | null;
    }>(
      `SELECT e.id, lc.status AS lc_status, e.source_url, lc.display_name,
              coalesce(lc.payload->>'canonicalUrl', lc.canonical_url) AS canonical,
              e.provenance->'identity' AS identity
         FROM research.entity_evidence e
         JOIN research.landscape_candidates lc ON lc.id = e.entity_id
        WHERE e.status = 'captured' AND e.source_url ~ '^https://[a-z]+\\.wikipedia\\.org/'`,
    );
    const unanchored = rows.filter(
      (row) =>
        !wikipediaPageAnchored({
          sourceUrl: row.source_url,
          canonicalUrl: row.canonical ?? undefined,
          displayName: row.display_name,
          placeKnown: row.identity?.placeKnown,
          placeCorroborated: row.identity?.placeCorroborated,
        }),
    );
    const pending = unanchored.filter((row) => row.lc_status === 'pending').map((row) => row.id);
    console.log(
      `${rows.length} captured Wikipedia rows; ${unanchored.length} unanchored ` +
        `(${pending.length} on pending candidates, ${unanchored.length - pending.length} on others, left alone)`,
    );
    if (!apply) {
      console.log('Dry run. --apply quarantines the pending ones.');
      return;
    }
    const result = await client.query(
      `UPDATE research.entity_evidence
          SET status = 'quarantined',
              provenance = provenance || jsonb_build_object('quarantineReason', $2::text,
                'quarantinedBy', 'quarantine-unanchored-wikipedia.ts', 'quarantinedAt', now())
        WHERE id = ANY($1::text[]) AND status = 'captured'`,
      [pending, REASON],
    );
    console.log(`quarantined ${result.rowCount}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
