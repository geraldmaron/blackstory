/**
 * Realign `bb_public.search_index` facet keys (and the `topics` / `status` columns) with the
 * release projection, for any key in `search-facet-realign.ts`'s `TARGET_REGISTRY`.
 *
 * `-era.ts`/`-jurisdiction.ts`/`-status.ts`/`-confidence.ts` are each a thin wrapper calling this
 * same machinery (`lib/search-facet-realign.ts`) with one key preset, kept as separate files only
 * because other modules name them by file. New facet keys — scalar, array, or a plain column —
 * should come here (add a `TARGET_REGISTRY` entry) rather than becoming a sixth hand-written
 * script.
 *
 * WHY A COPY AND NOT A REPUBLISH
 * The projection is already correct — this only copies it onto the search doc, so it needs no
 * builder run and cannot alter prose, claims, status or geometry. A republish would rebuild all
 * of that to fix a facet.
 *
 * THE ONE-DIRECTIONAL RULE, AND WHERE IT DOES NOT HOLD
 * A row is touched only when the projection carries a value AND the search doc's copy is empty.
 * Two conditions are reported and never written by default:
 *   - facet-only: the search doc has a value the projection lacks;
 *   - both-set-and-differing: both carry values and they disagree.
 * `OVERWRITE_CONFLICTS=1` resolves the second case toward the projection. It does not apply to
 * `status` or `confidenceTier`: those two targets always resolve a mismatch regardless of this
 * flag (see `lib/search-facet-realign.ts`'s module header for why).
 *
 * Measured on 2026-09-10 across the active release, `topicIds` and `mentionedEntityIds` are clean
 * on both counts. `notabilityBasis` and `notabilityLabels` each had 52 disagreeing rows, all of
 * them person records, and those were read individually rather than left as a standing warning.
 * The finding: 48 of 52 label conflicts and 45 of 52 basis conflicts are not disagreements at all
 * — the facet is a strict SUBSET of the projection, a stale snapshot taken before the projection
 * gained entries. Of the 7 genuine basis orphans, every one carries `evidenceIds: []`, and four of
 * them (the four girls killed in the 16th Street Baptist Church bombing) duplicate a
 * `movement_significance` criterion the projection already states WITH evidence. So the projection
 * won all 52, and `OVERWRITE_CONFLICTS=1` exists to say so.
 *
 * Two of the orphans carried substance the projection genuinely lacks — Ell Persons's lynching
 * catalyzing the Memphis NAACP branch, and Vernon Dahmer's Forrest County NAACP presidency and
 * poll-tax offer. Both are true and sourceable, and both are being restored through enrichment
 * WITH evidence rather than preserved here as unevidenced prose. A third, Emmett Till's, was not
 * merely unevidenced but over-scoped: NPS attributes the "catalyst" framing to activists' own
 * retrospective testimony, not as its own finding.
 *
 * SCOPE
 * `FACET_KEYS` and `KIND` keep a run small enough to verify. The catalog-wide population is large
 * and not all of it is this bug: `notabilityBasis` is empty on ~4,135 rows for reasons that predate
 * the incremental publisher. Run scoped, check the numbers, then widen.
 *
 * `summary` and `topics` are two keys the orchestrator runs through this same script rather than
 * through a dedicated one: `summary` copies `projection.summary` into `facets.summary` (a scalar
 * facet; carrying it catalog-wide is a size decision, not this backfill's call to make — several
 * MB added to the index — so it is tracked and decided separately from realigning it), and
 * `topics` copies the projection's topics into the `topics` COLUMN, because `topics` is not a
 * facets key at all (`mapPostgresSearchIndexRow` reads the column first, falling back to
 * `facets.topicTags`). Which topics: non-empty `topicTags`, else `topicIds` — one shared
 * definition in `lib/projection-divergence.ts`, not a second spelling here (repo-ttlce).
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   FACET_KEYS=topicIds,notabilityBasis,notabilityLabels KIND=invention \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-projection.ts
 *
 *   FACET_KEYS=summary,topics \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-projection.ts
 *
 * Apply:
 *   FACET_KEYS=topicIds,notabilityBasis,notabilityLabels KIND=invention \
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_PROJECTION_APPLY=1 node --conditions development \
 *     --import tsx packages/ops-data/scripts/backfill-search-facets-projection.ts
 *
 * THEN REPUBLISH THE ARTIFACTS. Writing the rows does not finish the job:
 *   cd apps/web && set -a && . ./.env.local && set +a \
 *     && node --conditions development --import tsx \
 *        ../../packages/ops-data/scripts/publish-release-catalog-artifacts.ts
 * Do not also dispatch publish-release-catalog-artifacts.yml: it runs this same script against
 * the same watermark and will report "up to date — skipping".
 * Production serves prebuilt entities.json / search-index.json from the CDN
 * (`APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL`), and the guard that is supposed to stop a stale
 * artifact only checks that its releaseId matches the active-release pointer. A backfill does
 * not change the release id, so the pre-backfill artifact passes and keeps serving until the
 * daily 09:17 UTC tick. On 2026-09-10 that cost half an hour of blaming the read cache.
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
 * Also resolve rows where BOTH sides carry values and they disagree, projection winning.
 *
 * Separate from APPLY because it discards published facet content rather than filling a hole.
 * Do not set it without reading the disagreeing rows first. The 52 person records reviewed on
 * 2026-09-10 were safe to resolve this way (see the header), but that was a finding about those
 * rows, not a property of the operation. Ignored for `status` and `confidenceTier`, which always
 * resolve a mismatch regardless of this flag.
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
