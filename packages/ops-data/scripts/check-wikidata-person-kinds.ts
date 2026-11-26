/**
 * Find candidates filed under a non-person kind whose Wikidata item is a human (P31 = Q5). Such a
 * row skips the person privacy gate in the publisher, which keys on `kind = 'person'`. The 2026-11-25
 * burn-down pilot found five persons filed as `other` or `institution`.
 *
 * Read-only by default: prints every mismatch. With --apply it sets `kind` (and `payload.kind`) to
 * `person` on PENDING rows only. A mismatch on an accepted (live) row is reported, never rewritten:
 * a live person who skipped the privacy review needs that review, not a silent kind change.
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   DATABASE_URL="$ADMIN_DATABASE_URL" node --conditions development --import tsx \
 *     packages/ops-data/scripts/check-wikidata-person-kinds.ts [--apply]
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { defaultJsonFetcher, sparqlBindings, sparqlUrl } from './source-register.ts';

/** One VALUES probe for many items; an index lookup, well under the query service's time limit. */
export function buildHumanProbeQuery(qids: readonly string[]): string {
  const values = qids.filter((qid) => /^Q\d+$/u.test(qid)).map((qid) => `wd:${qid}`);
  return `SELECT ?item WHERE { VALUES ?item { ${values.join(' ')} } ?item wdt:P31 wd:Q5 . }`;
}

export function humanQids(payload: unknown): Set<string> {
  return new Set(
    sparqlBindings(payload)
      .map((binding) => binding.item?.value.split('/').pop() ?? '')
      .filter((qid) => /^Q\d+$/u.test(qid)),
  );
}

type Row = { id: string; status: string; kind: string; display_name: string; qid: string };

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (the admin login)');
  const client = new pg.Client(normalizePgConnectionString(databaseUrl));
  await client.connect();
  try {
    const { rows } = await client.query<Row>(
      `SELECT id, status, kind, display_name,
              coalesce(provenance->>'wikidataId', payload->'provenance'->>'wikidataId') AS qid
         FROM research.landscape_candidates
        WHERE kind <> 'person'
          AND status IN ('pending', 'accepted')
          AND coalesce(provenance->>'wikidataId', payload->'provenance'->>'wikidataId') ~ '^Q[0-9]+$'`,
    );
    const humans = new Set<string>();
    for (let start = 0; start < rows.length; start += 200) {
      if (start > 0) await new Promise((done) => setTimeout(done, 1_000));
      const batch = rows.slice(start, start + 200).map((row) => row.qid);
      for (const qid of humanQids(await defaultJsonFetcher(sparqlUrl(buildHumanProbeQuery(batch)))))
        humans.add(qid);
    }
    const mismatched = rows.filter((row) => humans.has(row.qid));
    console.log(`checked ${rows.length} rows; ${mismatched.length} are humans in Wikidata`);
    for (const row of mismatched) {
      console.log(
        `  ${row.status.padEnd(8)} ${row.kind.padEnd(12)} ${row.qid.padEnd(11)} ${row.id}  ${row.display_name}`,
      );
    }
    const live = mismatched.filter((row) => row.status === 'accepted');
    if (live.length > 0) {
      console.log(
        `\n${live.length} live record(s) above need a person privacy review; not changed here.`,
      );
    }
    const pending = mismatched.filter((row) => row.status === 'pending').map((row) => row.id);
    if (!apply) {
      console.log(`\nDry run. --apply sets kind = person on the ${pending.length} pending row(s).`);
      return;
    }
    if (pending.length > 0) {
      const result = await client.query(
        `UPDATE research.landscape_candidates
            SET kind = 'person',
                payload = jsonb_set(payload, '{kind}', '"person"', true),
                provenance = provenance || jsonb_build_object(
                  'kindCorrectedFrom', kind, 'kindCorrectedBy', 'check-wikidata-person-kinds.ts',
                  'kindCorrectedAt', now()),
                updated_at = now()
          WHERE id = ANY($1::text[]) AND status = 'pending' AND kind <> 'person'`,
        [pending],
      );
      console.log(`set kind = person on ${result.rowCount} pending row(s)`);
    }
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
