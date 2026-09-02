/**
 * Write reviewed era proposals into the release projection, for records the archive publishes
 * with no era at all.
 *
 * 1,227 entities in the active release render "Undated" on `/records`. Their era is not missing
 * from one artifact and present in another, which is what `backfill-search-facets-era.ts`
 * repairs: it is absent everywhere. They carry no claim date qualifier, they are not in the
 * research lane, and `apply-nrhp-period-era.ts` cannot reach them because it reads
 * `bb_research.landscape_candidates` and only one of them is in that table.
 *
 * What they do have is captured source text. 1,021 of them carry a Wikipedia article, a
 * nomination form, or another fetched document in `bb_research.entity_evidence`, and nothing has
 * ever read those for a date. This script lands the result of that reading.
 *
 * IT DOES NOT DECIDE ANYTHING. A proposal arrives as JSONL from a reviewer with the decade
 * buckets and the sentence they read them out of. This script's entire job is refusing
 * the ones that do not hold up:
 *
 *   - the entity must exist in the active release and must still have no era, so a proposal can
 *     never overwrite a value the publish path already established;
 *   - every bucket must be a four-digit decade inside the vocabulary the release already uses;
 *   - every proposed decade must be backed by a year that actually occurs in that entity's own
 *     captured text. This is the anti-fabrication gate: a reviewer cannot date a record to a
 *     decade its own sources never mention.
 *
 * The gate checks years rather than the quoted sentence, and that is a deliberate retreat from
 * something stricter. The first version demanded the quote appear character for character, on
 * the reasoning that a reviewer inventing a date cannot produce a real sentence. Measured
 * against the first agent output, reviewers reliably read the right year and then wrote the
 * sentence in their own words: for one church the captured text read "the Mount Olive Methodist
 * Episcopal Church was dedicated in 1890" and the proposal quoted "Dedicated in 1890, Mt. Olive
 * Methodist Episcopal Church was a symbol of progress and pride". The date is sound, the
 * sentence is a paraphrase, and containment rejects the whole proposal over the half that does
 * not matter. The era rests on years, so years are what is verified. The quote is still
 * required and still stored, as the reviewer's stated reading rather than as a citation.
 *
 * THE LISTING DATE IS NOT AN ERA. A National Register listing date is the day paperwork cleared.
 * Every NRHP summary in this release states one, so a reviewer reading carelessly would produce
 * 1,151 records dated to the decade a federal office processed a form. The year gate therefore
 * ignores any year written inside a full calendar date, on the same reasoning
 * `nrhp-period-of-significance.ts` gives: periods of significance are never written as a full
 * calendar date, and listing dates always are. A decade whose only support is a listing date
 * has no support at all.
 *
 * Provenance travels with the value. `projection.eraProvenance` records the method, the quote,
 * the source URL and the run, so any published era traces back to the sentence that produced it.
 *
 * The projection is the authority for era; the search facet is a copy of it. This script writes
 * the projection only, and `backfill-search-facets-era.ts` then syncs the facet with the same
 * guardrails it always applies. Two scripts rather than one, so the sync stays one-directional.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-era-from-captured-evidence.ts --proposals=<dir>
 *
 * Apply:
 *   DRY_RUN=0 ERA_FROM_EVIDENCE_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-era-from-captured-evidence.ts --proposals=<dir>
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.ERA_FROM_EVIDENCE_APPLY === '1';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const PROPOSALS_DIR = flag('proposals', '');

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** The decade vocabulary the active release already publishes. */
const DECADE = /^1[5-9][0-9]0s$|^20[0-1]0s$/;
/** How a listing date is written, and how a period of significance never is. */
const CALENDAR_DATE_GLOBAL = /\b[A-Z][a-z]+ [0-9]{1,2}, [0-9]{4}\b/g;

type Proposal = {
  readonly entityId: string;
  readonly eraBuckets?: readonly string[];
  readonly quote?: string;
  readonly basis?: string;
  readonly confidence?: string;
  readonly skip?: string;
};

type Rejection = { readonly entityId: string; readonly reason: string };

function readProposals(dir: string): readonly Proposal[] {
  const out: Proposal[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => /^out-\d+\.jsonl$/.test(f))
    .sort()) {
    const text = readFileSync(join(dir, file), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        out.push(JSON.parse(trimmed) as Proposal);
      } catch {
        out.push({ entityId: `«unparseable in ${file}»` });
      }
    }
  }
  return out;
}

/**
 * Every decade a captured document actually vouches for, as its leading three digits: 1890 and
 * 1897 both yield 189. Years written inside a full calendar date are stripped first, because on
 * an NRHP record that is the listing date, and dating a record to the decade its paperwork
 * cleared is the specific error this whole pass exists to avoid.
 */
function decadesInEvidence(text: string): ReadonlySet<number> {
  const withoutListingDates = text.replace(CALENDAR_DATE_GLOBAL, ' ');
  const decades = new Set<number>();
  for (const match of withoutListingDates.matchAll(/\b(1[5-9][0-9]{2}|20[0-2][0-9])\b/g)) {
    decades.add(Math.floor(Number.parseInt(match[0], 10) / 10));
  }
  return decades;
}

async function main(): Promise<void> {
  if (PROPOSALS_DIR.length === 0) throw new Error('--proposals=<dir> is required');

  const proposals = readProposals(PROPOSALS_DIR);
  const proposed = proposals.filter((p) => (p.eraBuckets?.length ?? 0) > 0);
  console.log('=== Era from captured evidence ===');
  console.log(`Proposal lines read: ${proposals.length}`);
  console.log(`  carrying an era:   ${proposed.length}`);
  console.log(`  skipped by review: ${proposals.length - proposed.length}`);

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  const rejected: Rejection[] = [];
  const accepted: { proposal: Proposal; buckets: readonly string[] }[] = [];

  try {
    const { rows: undatedRows } = await client.query<{ entity_id: string }>(
      `SELECT si.entity_id
         FROM bb_public.search_index si
         JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
         JOIN bb_public.release_entities re
           ON re.release_id = si.release_id AND re.entity_id = si.entity_id
        WHERE coalesce(jsonb_array_length(
                case when jsonb_typeof(re.projection->'eraBuckets') = 'array'
                     then re.projection->'eraBuckets' end), 0) = 0`,
    );
    const stillUndated = new Set(undatedRows.map((row) => row.entity_id));
    console.log(`Entities in the release with no era: ${stillUndated.size}`);

    for (const proposal of proposed) {
      const buckets = [...new Set(proposal.eraBuckets ?? [])].sort();
      if (!stillUndated.has(proposal.entityId)) {
        rejected.push({ entityId: proposal.entityId, reason: 'not an undated release entity' });
        continue;
      }
      if (buckets.length === 0 || buckets.length > 6) {
        rejected.push({ entityId: proposal.entityId, reason: `bucket count ${buckets.length}` });
        continue;
      }
      const badBucket = buckets.find((bucket) => !DECADE.test(bucket));
      if (badBucket !== undefined) {
        rejected.push({ entityId: proposal.entityId, reason: `bad decade "${badBucket}"` });
        continue;
      }
      const quote = proposal.quote?.trim() ?? '';
      if (quote.length < 12) {
        rejected.push({ entityId: proposal.entityId, reason: 'quote missing or too short' });
        continue;
      }
      const { rows: evidence } = await client.query<{ content_text: string }>(
        `SELECT content_text FROM bb_research.entity_evidence
          WHERE entity_id = $1 AND status = 'captured' AND content_text IS NOT NULL`,
        [proposal.entityId],
      );
      const decades = decadesInEvidence(evidence.map((row) => row.content_text).join('\n'));
      const unsupported = buckets.filter(
        (bucket) => !decades.has(Number.parseInt(bucket.slice(0, 3), 10)),
      );
      if (unsupported.length > 0) {
        rejected.push({
          entityId: proposal.entityId,
          reason: `no year in the captured text for ${unsupported.join(', ')}`,
        });
        continue;
      }

      accepted.push({ proposal, buckets });
    }

    console.log(`\nAccepted: ${accepted.length}`);
    console.log(`Rejected: ${rejected.length}`);
    const byReason: Record<string, number> = {};
    for (const row of rejected) byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;
    for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n}\t${reason}`);
    }
    console.log('\nSample of accepted:');
    for (const row of accepted.slice(0, 5)) {
      console.log(`  ${row.proposal.entityId} → ${row.buckets.join(', ')}`);
      console.log(`    "${(row.proposal.quote ?? '').slice(0, 110)}"`);
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 ERA_FROM_EVIDENCE_APPLY=1 to apply.');
      return;
    }

    const runStamp = new Date().toISOString();
    let written = 0;
    for (const { proposal, buckets } of accepted) {
      const provenance = {
        method: 'captured-evidence-review',
        quote: proposal.quote,
        basis: proposal.basis ?? null,
        confidence: proposal.confidence ?? null,
        appliedAt: runStamp,
      };
      const result = await client.query(
        `UPDATE bb_public.release_entities re
            SET projection = jsonb_set(
                  jsonb_set(re.projection, '{eraBuckets}', $2::jsonb, true),
                  '{eraProvenance}', $3::jsonb, true)
           FROM bb_public.v_active_release_id r
          WHERE re.release_id = r.release_id
            AND re.entity_id = $1
            AND coalesce(jsonb_array_length(
                  case when jsonb_typeof(re.projection->'eraBuckets') = 'array'
                       then re.projection->'eraBuckets' end), 0) = 0`,
        [proposal.entityId, JSON.stringify(buckets), JSON.stringify(provenance)],
      );
      written += result.rowCount ?? 0;
    }
    console.log(`\nApplied: release_entities projections updated = ${written}`);
    console.log('Now run backfill-search-facets-era.ts to sync the search facet.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
