/**
 * Fails when a doc cites a hardcoded `bb_canonical.entities` count that has
 * drifted from the live database. See docs/data/entity-count-metric.md for
 * why canonical (not release_entities, not Firestore) is the single source
 * of truth for entity count.
 *
 * Docs opt in by embedding a machine-readable marker anywhere in the file:
 *   <!-- canonical-count: 4092 as-of 2026-07-29 -->
 * The number after `canonical-count:` is compared against a live COUNT(*)
 * query. Mismatches fail the check (exit 1) instead of silently going stale
 * the way docs/research/corsair-pending-inventory.md did (claimed 666 while
 * live canonical had already passed 1395 -- the same drift class as the BJS
 * incident).
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/check-canonical-count-drift.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');

const MARKER_RE = /<!--\s*canonical-count:\s*(\d+)[^>]*-->/g;

const TRACKED_DOCS = [
  'docs/data/entity-count-metric.md',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set. source apps/web/.env.local first.');
    process.exit(2);
  }

  const client = new pg.Client(normalizePgConnectionString(connectionString));
  await client.connect();
  const { rows } = await client.query<{ count: string }>(
    'select count(*)::text as count from bb_canonical.entities',
  );
  await client.end();
  const liveCount = Number(rows[0]?.count ?? Number.NaN);
  if (!Number.isFinite(liveCount)) {
    console.error('Could not read live canonical count.');
    process.exit(2);
  }

  let failures = 0;
  let checked = 0;

  for (const relPath of TRACKED_DOCS) {
    const absPath = join(REPO_ROOT, relPath);
    let text: string;
    try {
      text = readFileSync(absPath, 'utf8');
    } catch {
      console.error(`MISSING: ${relPath} (listed in TRACKED_DOCS but not found)`);
      failures++;
      continue;
    }
    const matches = [...text.matchAll(MARKER_RE)];
    if (matches.length === 0) {
      console.error(`NO MARKER: ${relPath} is tracked but has no canonical-count marker`);
      failures++;
      continue;
    }
    for (const match of matches) {
      checked++;
      const docCount = Number(match[1]);
      if (docCount !== liveCount) {
        console.error(
          `DRIFT: ${relPath} says canonical-count: ${docCount}, live bb_canonical.entities = ${liveCount}`,
        );
        failures++;
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} drift/config issue(s) found across ${checked} marker(s).`);
    process.exit(1);
  }
  console.log(`OK: ${checked} marker(s) match live canonical count (${liveCount}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
