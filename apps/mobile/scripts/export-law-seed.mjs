/**
 * Export the legal snapshot catalog from the active Supabase release into mobile JSON.
 *
 * Source of truth is bb_public.release_legal_snapshots (published by
 * packages/ops-data/scripts/load-legal-snapshots-to-supabase.ts), not a committed
 * TS seed. Each payload is already the public document shape; the mapping below
 * only flattens a payload into the entry row the mobile law catalog reads.
 *
 * Run from repo root via the single entrypoint:
 *   node --conditions=development --import tsx apps/mobile/scripts/generate-seeds.mjs law
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePgConnectionString } from '../../../packages/ops-data/scripts/lib/pg-connection.ts';

const here = dirname(fileURLToPath(import.meta.url));
// `pg` is a dependency of ops-data, not the mobile app — resolve it from there.
const requireFromOpsData = createRequire(
  resolve(here, '../../../packages/ops-data/package.json'),
);
const pg = requireFromOpsData('pg');
const outPath = resolve(here, '../src/features/law/catalog-seed.json');

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL (or APP_DATABASE_URL) is required — source apps/web/.env.local');
}
const conn = normalizePgConnectionString(databaseUrl);
const client = new pg.Client({
  connectionString: conn.connectionString,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
await client.connect();
const { rows: released } = await client.query(`
  SELECT release_id, payload
  FROM bb_public.release_legal_snapshots
  WHERE release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  ORDER BY snapshot_id
`);
await client.end();

if (released.length === 0) {
  throw new Error(
    'active release contains no legal snapshots — run packages/ops-data/scripts/load-legal-snapshots-to-supabase.ts first',
  );
}

const entries = released.map(({ payload }) => ({
  id: payload.id,
  slug: payload.slug,
  title: payload.title,
  kind: payload.kind,
  lawStatus: payload.lawStatus,
  jurisdictionId: payload.jurisdictionId,
  topics: [...payload.topics],
  citation: payload.citation.canonicalCitation,
  sourceUrl: payload.citation.archive.sourceUrl,
  officialUrl: payload.citation.archive.officialUrl ?? payload.citation.archive.sourceUrl,
  archivedCaptureUrl: payload.citation.archive.archivedCaptureUrl,
  retrievedAt: payload.citation.archive.retrievedAt,
  licenseTag: payload.citation.licenseTag,
  ...(payload.factId ? { factId: payload.factId } : {}),
  ...(payload.canonicalEntityId ? { canonicalEntityId: payload.canonicalEntityId } : {}),
  ...(payload.explainer
    ? {
        explainer: {
          whatItSays: payload.explainer.whatItSays,
          whatItMeans: [...payload.explainer.whatItMeans],
          whyItMatters: [...payload.explainer.whyItMatters],
          rightsToday: payload.explainer.rightsToday.map((row) => ({
            label: row.label,
            agencyUrl: row.agencyUrl,
          })),
          primarySources: payload.explainer.primarySources.map((row) => ({
            label: row.label,
            url: row.url,
            licenseTag: row.licenseTag,
          })),
          reviewedAt: payload.explainer.reviewedAt,
          ...(payload.explainer.termOfArtLinks
            ? {
                termOfArtLinks: payload.explainer.termOfArtLinks.map((row) => ({
                  term: row.term,
                  wexUrl: row.wexUrl,
                })),
              }
            : {}),
        },
      }
    : {}),
}));

const snapshot = {
  version: released[0].release_id,
  generatedAt: new Date().toISOString(),
  source: 'supabase-active-release',
  entries,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath} (${entries.length} law entries, version ${snapshot.version})`);
