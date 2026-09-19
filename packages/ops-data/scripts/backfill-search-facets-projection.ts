/**
 * Realigns registered search facets and columns from the release projection without rebuilding
 * narrative or claims. By default, report conflicting or facet-only values rather than
 * overwriting them. OVERWRITE_CONFLICTS=1 resolves supported conflicts toward the projection;
 * status and evidenceInputs use their own authoritative synchronization rules.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  applySearchFacetRealign,
  DEFAULT_ARRAY_KEYS,
  planSearchFacetRealign,
  TARGET_REGISTRY,
} from './lib/search-facet-realign.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_PROJECTION_APPLY === '1';
/**
 * Resolve conflicting nonempty values toward the projection only after inspecting the affected
 * rows. This is distinct from APPLY because it replaces content. Status and evidenceInputs
 * follow their own synchronization rules.
 */
const OVERWRITE_CONFLICTS = process.env.OVERWRITE_CONFLICTS === '1';

function facetKeys(): readonly string[] {
  const raw = process.env.FACET_KEYS?.trim();
  const keys = raw
    ? raw
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : [...DEFAULT_ARRAY_KEYS];
  for (const key of keys) {
    if (!(key in TARGET_REGISTRY)) {
      throw new Error(
        `Unknown FACET_KEYS entry: ${JSON.stringify(key)}. Known keys: ${Object.keys(TARGET_REGISTRY).join(', ')}`,
      );
    }
  }
  if (keys.length === 0) throw new Error('FACET_KEYS resolved to an empty list');
  return keys;
}

function kindFilter(): string | undefined {
  const raw = process.env.KIND?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const keys = facetKeys();
  const kind = kindFilter();

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== Realign search_index facets/columns from the release projection ===');
    console.log(`Keys:  ${keys.join(', ')}`);
    console.log(`Scope: ${kind ? `kind = ${kind}` : 'whole active release'}\n`);

    const plan = await planSearchFacetRealign(client, {
      keys,
      kind,
      resolveConflicts: OVERWRITE_CONFLICTS,
    });

    for (const report of plan.targets) {
      console.log(
        `${report.key} (${report.mode})\n  filled (projection set, search doc empty): ${report.filled}` +
          `\n  left untouched — search doc set, projection empty: ${report.facetOnly}` +
          `\n  ${report.resolved > 0 ? 'resolved' : 'left untouched'} — both set and disagreeing: ${
            report.resolved > 0 ? report.resolved : report.leftConflicts
          }`,
      );
      if (report.leftConflicts > 0) {
        console.log(
          '  ^ reviewed separately; pass OVERWRITE_CONFLICTS=1 to resolve to projection.',
        );
      }
      console.log('');
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        `Dry run only. Rows that would change: ${plan.changes.length}. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_PROJECTION_APPLY=1 to apply.`,
      );
      return;
    }

    const updated = await applySearchFacetRealign(client, plan);
    console.log(`Total rows updated: ${updated}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
