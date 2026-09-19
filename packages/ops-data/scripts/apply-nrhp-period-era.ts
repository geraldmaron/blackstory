/**
 * Adds nomination periods of significance to missing eraBuckets and records the matched text
 * and document in eraProvenance. Existing eras remain intact. Construction dates are not
 * substituted. Default dry-run; apply requires DRY_RUN=0 and NRHP_ERA_APPLY=1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  decadeBucketsForPeriod,
  extractPeriodOfSignificance,
} from './lib/nrhp-period-of-significance.ts';

const apply = process.env.DRY_RUN === '0' && process.env.NRHP_ERA_APPLY === '1';
const databaseUrl = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

type Row = {
  readonly id: string;
  readonly content_text: string | null;
  readonly source_url: string | null;
  readonly existing_era: string[] | null;
};

const conn = normalizePgConnectionString(databaseUrl);
const pool = new pg.Pool({
  connectionString: conn.connectionString,
  max: 2,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
const client = await pool.connect();

try {
  const { rows } = await client.query<Row>(
    `SELECT lc.id, ev.content_text, ev.source_url,
            CASE WHEN jsonb_typeof(lc.payload->'eraBuckets') = 'array'
                 THEN ARRAY(SELECT jsonb_array_elements_text(lc.payload->'eraBuckets'))
                 ELSE NULL END AS existing_era
       FROM research.landscape_candidates lc
       JOIN research.entity_evidence ev
         ON ev.entity_id = lc.id AND ev.collector = 'nrhp-nomination' AND ev.status = 'captured'
      WHERE lc.lane = 'nrhp-black-heritage'`,
  );

  const byMethod: Record<string, number> = {};
  const bump = (k: string) => {
    byMethod[k] = (byMethod[k] ?? 0) + 1;
  };
  const updates: {
    id: string;
    buckets: readonly string[];
    method: string;
    evidence: string;
    sourceUrl: string | null;
  }[] = [];
  let keptExisting = 0;
  let noPeriod = 0;

  for (const row of rows) {
    if (row.existing_era !== null && row.existing_era.length > 0) {
      keptExisting++;
      continue;
    }
    const period = extractPeriodOfSignificance(row.content_text ?? '');
    if (!period) {
      noPeriod++;
      continue;
    }
    bump(period.method);
    updates.push({
      id: row.id,
      buckets: decadeBucketsForPeriod(period),
      method: period.method,
      evidence: period.evidence,
      sourceUrl: row.source_url,
    });
  }

  console.log(`nrhp rows with a captured nomination: ${rows.length}`);
  console.log(`  already carry an era (left alone): ${keptExisting}`);
  console.log(`  nomination states no period:       ${noPeriod}`);
  console.log(`  WOULD WRITE an era:                ${updates.length}`);
  console.log(`  by method: ${JSON.stringify(byMethod)}`);
  console.log('\nsamples:');
  for (const u of updates.slice(0, 6)) {
    console.log(
      `  - ${u.id} [${u.method}] ${u.buckets.join(',')} from "${u.evidence.slice(0, 40)}"`,
    );
  }

  const artifactDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../.cache/canonical-corrections',
  );
  mkdirSync(artifactDir, { recursive: true });
  const artifact = join(artifactDir, 'repo-8zvt-nrhp-period-era.json');
  writeFileSync(
    artifact,
    JSON.stringify({ generatedAt: new Date().toISOString(), applied: apply, updates }, null, 2),
  );
  console.log(`\nReport: ${artifact}`);

  if (!apply) {
    console.log('DRY RUN: no database writes. Set DRY_RUN=0 NRHP_ERA_APPLY=1 to apply.');
  } else if (updates.length === 0) {
    console.log('Nothing to write.');
  } else {
    await client.query('BEGIN');
    try {
      let written = 0;
      for (const u of updates) {
        // jsonb_set twice rather than a payload merge: this must add two keys and disturb nothing
        // else in a payload that carries geo, topics and source fields.
        const result = await client.query(
          `UPDATE research.landscape_candidates
              SET payload = jsonb_set(
                    jsonb_set(payload, '{eraBuckets}', $2::jsonb, true),
                    '{eraProvenance}', $3::jsonb, true),
                  updated_at = now()
            WHERE id = $1
              AND (NOT payload ? 'eraBuckets'
                   OR jsonb_typeof(payload->'eraBuckets') <> 'array'
                   OR jsonb_array_length(payload->'eraBuckets') = 0)`,
          [
            u.id,
            JSON.stringify(u.buckets),
            JSON.stringify({
              source: 'nrhp-nomination',
              method: u.method,
              evidence: u.evidence,
              sourceUrl: u.sourceUrl,
            }),
          ],
        );
        written += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
      console.log(`\nAPPLIED: wrote era to ${written} rows.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
