/**
 * Append reviewed citations to landscape candidates that already exist, whatever lane staged
 * them, so a record that is accepted or live can gain evidence without being re-authored.
 *
 * Input is the shape the research fan-out produces: a JSON file with
 * `{ records: [ { id, newEvidence: [ { sourceUrl, title, quote } ] } ] }`. Every quote in that
 * file is expected to have been verified as an exact passage of the fetched page before it gets
 * here; this script does not fetch. It merges by document and passage
 * (`lib/landscape-evidence-merge.ts`), touches only `payload.evidenceCitations`, stamps the
 * provenance with who appended what and when, and leaves `status` alone: the incremental
 * publisher re-derives the record on the next `--lane <lane> --republish`, and that is where
 * the confidence floor and the depth gate are applied.
 *
 * Dry-run unless DRY_RUN=0 and APPLY=1. APPENDED_BY names who stands behind the review.
 *
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/stage-landscape-evidence.ts \
 *     --file=/path/to/evidence.json [--lane=research-cases]
 *   DRY_RUN=0 APPLY=1 APPENDED_BY="<operator>" node --conditions development --import tsx \
 *     packages/ops-data/scripts/stage-landscape-evidence.ts --file=... --lane=...
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { mergeEvidenceCitations } from './lib/landscape-evidence-merge.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY === '1';
const APPENDED_BY = process.env.APPENDED_BY?.trim() || '';

function readArg(prefix: string): string | undefined {
  const hit = process.argv.find((entry) => entry.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

type InputRecord = { readonly id: string; readonly newEvidence?: readonly unknown[] };

async function main(): Promise<void> {
  const file = readArg('--file=');
  if (!file) throw new Error('--file=<evidence.json> is required');
  const lane = readArg('--lane=');
  const input = JSON.parse(readFileSync(file, 'utf8')) as { records?: InputRecord[] };
  const records = (input.records ?? []).filter((r) => typeof r.id === 'string');
  if (records.length === 0) throw new Error(`${file} has no records`);
  if (!DRY_RUN && APPLY && APPENDED_BY.length === 0) {
    throw new Error('APPENDED_BY is required to apply (it is recorded in provenance)');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    console.log(`landscape evidence: ${records.length} records from ${file}`);
    console.log(DRY_RUN || !APPLY ? 'dry-run' : 'apply');
    let totalAdded = 0;
    for (const record of records) {
      const row = await client.query<{
        id: string;
        lane: string;
        status: string;
        citations: unknown;
      }>(
        `SELECT id, lane, status, payload->'evidenceCitations' AS citations
           FROM bb_research.landscape_candidates
          WHERE id = $1 AND ($2::text IS NULL OR lane = $2)`,
        [record.id, lane ?? null],
      );
      const found = row.rows[0];
      if (!found) {
        console.log(`  ${record.id}  NOT FOUND${lane ? ` in lane ${lane}` : ''}`);
        continue;
      }
      const existing = Array.isArray(found.citations) ? found.citations : [];
      const merged = mergeEvidenceCitations(existing, record.newEvidence ?? []);
      console.log(
        `  ${found.id}  [${found.lane}/${found.status}]  ${existing.length} -> ${merged.citations.length}  (+${merged.added.length}, skipped ${merged.skipped.length})`,
      );
      for (const skip of merged.skipped)
        console.log(`      skip: ${skip.reason}  ${skip.citation.sourceUrl}`);
      for (const added of merged.added) console.log(`      +    ${added.sourceUrl}`);
      if (merged.added.length === 0 || DRY_RUN || !APPLY) continue;
      await client.query(
        `UPDATE bb_research.landscape_candidates
            SET payload = jsonb_set(payload, '{evidenceCitations}', $2::jsonb, true),
                provenance = provenance || jsonb_build_object(
                  'evidenceAppendedAt', now(),
                  'evidenceAppendedBy', $3::text,
                  'evidenceAppendedCount', coalesce((provenance->>'evidenceAppendedCount')::int, 0) + $4::int),
                updated_at = now()
          WHERE id = $1`,
        [found.id, JSON.stringify(merged.citations), APPENDED_BY, merged.added.length],
      );
      totalAdded += merged.added.length;
    }
    console.log(`appended ${totalAdded} citation(s)`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
