/**
 * Stages validated enrichment drafts on landscape candidates, including narrative, taxonomy and
 * source citations. This does not publish. Default dry-run; writes require DRY_RUN=0 and
 * APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY=1. Use --entity-ids to scope the batch, then review
 * through the incremental publisher.
 */
import pg from 'pg';
import { SUMMARY_MIN_CHARS, SUMMARY_MAX_CHARS } from './lib/entity-enrichment-llm.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

/** A ledger draft passes bounds if it's in-band, or below-band with a valid bestEffort flag. */
function summaryInBounds(draft: { summary?: unknown; bestEffort?: unknown }): boolean {
  const summary = typeof draft.summary === 'string' ? draft.summary : undefined;
  if (summary === undefined || summary.length > SUMMARY_MAX_CHARS) return false;
  if (summary.length >= SUMMARY_MIN_CHARS) return true;
  return draft.bestEffort === true;
}

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY === '1';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const ENTITY_IDS = flag('entity-ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
const LANES = flag('lanes', '')
  .split(',')
  .map((lane) => lane.trim())
  .filter((lane) => lane.length > 0);

type EnrichedRow = {
  readonly entity_id: string;
  readonly notes: {
    readonly draft?: {
      readonly summary?: unknown;
      readonly historicalContext?: unknown;
      readonly topicIds?: unknown;
      readonly eraBuckets?: unknown;
      readonly keywords?: unknown;
      readonly summaryCitations?: unknown;
      readonly historicalContextCitations?: unknown;
      readonly bestEffort?: unknown;
      readonly bestEffortReason?: unknown;
    };
  };
};

/** One captured evidence document, as `entity_evidence` stores it. */
type EvidenceDocRow = {
  readonly entity_id: string;
  readonly id: string;
  readonly source_url: string;
  readonly title: string | null;
  readonly source_tier: string;
};

type EvidenceCitation = {
  readonly sourceUrl: string;
  readonly title: string | null;
  readonly sourceTier: string;
  readonly quote: string;
};

function citationEntries(raw: unknown): { evidenceId: string; quote: string }[] {
  if (!Array.isArray(raw)) return [];
  const entries: { evidenceId: string; quote: string }[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.evidenceId !== 'string' || typeof record.quote !== 'string') continue;
    entries.push({ evidenceId: record.evidenceId, quote: record.quote });
  }
  return entries;
}

/**
 * Builds one evidenceCitations entry per distinct document, retaining the longest anchored
 * quote. Repeated quotations from one document must not inflate document coverage. Quotation
 * attachment alone does not prove the draft's claims.
 */
function buildEvidenceCitations(
  draft: NonNullable<EnrichedRow['notes']['draft']>,
  docsById: ReadonlyMap<string, EvidenceDocRow>,
): EvidenceCitation[] {
  const bestQuoteByDoc = new Map<string, { doc: EvidenceDocRow; quote: string }>();
  for (const entry of [
    ...citationEntries(draft.summaryCitations),
    ...citationEntries(draft.historicalContextCitations),
  ]) {
    const doc = docsById.get(entry.evidenceId);
    if (doc === undefined) continue;
    const quote = entry.quote.trim();
    if (quote.length === 0) continue;
    const existing = bestQuoteByDoc.get(doc.source_url);
    if (existing === undefined || quote.length > existing.quote.length) {
      bestQuoteByDoc.set(doc.source_url, { doc, quote });
    }
  }
  return [...bestQuoteByDoc.values()].map(({ doc, quote }) => ({
    sourceUrl: doc.source_url,
    title: doc.title,
    sourceTier: doc.source_tier,
    quote,
  }));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  if (ENTITY_IDS.length === 0 && LANES.length === 0) {
    throw new Error('Pass --entity-ids=id1,id2,... and/or --lanes=lane1,lane2');
  }
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const params: unknown[] = [];
  let idClause = '';
  let laneClause = '';
  if (ENTITY_IDS.length > 0) {
    params.push(ENTITY_IDS);
    idClause = `entity_id = ANY($${params.length}::text[])`;
  }
  if (LANES.length > 0) {
    params.push(LANES);
    laneClause = `lane = ANY($${params.length}::text[])`;
  }
  const whereClause = [idClause, laneClause].filter(Boolean).join(' OR ');

  const rows = await pool.query<EnrichedRow>(
    `SELECT entity_id, notes
       FROM research.entity_enrichment
      WHERE status = 'enriched' AND (${whereClause})
      ORDER BY entity_id`,
    params,
  );
  console.log(`Found ${rows.rows.length} enriched entit(ies) to stage onto landscape_candidates.`);

  // Only 'captured' evidence is citable — a quarantined document (failed identity or OCR-quality
  // check at sweep time) must never become a public citation, however the draft referenced it.
  const evidenceRows = await pool.query<EvidenceDocRow>(
    `SELECT entity_id, id, source_url, title, source_tier
       FROM research.entity_evidence
      WHERE status = 'captured' AND entity_id = ANY($1::text[])`,
    [rows.rows.map((row) => row.entity_id)],
  );
  const docsById = new Map(evidenceRows.rows.map((row) => [row.id, row]));

  const staged: {
    entityId: string;
    summaryLen: number;
    topicIds: number;
    eraBuckets: number;
    keywords: number;
    evidenceCitations: EvidenceCitation[];
  }[] = [];
  const skipped: { entityId: string; reason: string }[] = [];

  for (const row of rows.rows) {
    const draft = row.notes.draft;
    if (draft === undefined) {
      skipped.push({
        entityId: row.entity_id,
        reason: 'no draft in notes (unexpected for status=enriched)',
      });
      continue;
    }
    const summary = typeof draft.summary === 'string' ? draft.summary : undefined;
    if (summary === undefined || !summaryInBounds(draft)) {
      skipped.push({
        entityId: row.entity_id,
        reason: `summary missing or out of bounds (${summary?.length ?? 'n/a'})`,
      });
      continue;
    }
    staged.push({
      entityId: row.entity_id,
      summaryLen: summary.length,
      topicIds: Array.isArray(draft.topicIds) ? draft.topicIds.length : 0,
      eraBuckets: Array.isArray(draft.eraBuckets) ? draft.eraBuckets.length : 0,
      keywords: Array.isArray(draft.keywords) ? draft.keywords.length : 0,
      evidenceCitations: buildEvidenceCitations(draft, docsById),
    });
  }

  for (const item of staged) {
    console.log(
      `  ${item.entityId}: summary=${item.summaryLen} chars, topicIds=${item.topicIds}, ` +
        `eraBuckets=${item.eraBuckets}, keywords=${item.keywords}, ` +
        `evidenceDocs=${item.evidenceCitations.length}`,
    );
  }
  // A staged row with zero citable documents still publishes its prose, but it will be judged by
  // the depth gate on historicalContext alone — worth seeing in the run output rather than
  // discovering as a template_only skip one step later.
  const withoutDocs = staged.filter((item) => item.evidenceCitations.length === 0);
  if (withoutDocs.length > 0) {
    console.log(
      `\n${withoutDocs.length} staged row(s) resolved NO citable evidence document ` +
        `(draft cited only quarantined or missing evidence).`,
    );
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const item of skipped) console.log(`  ${item.entityId}: ${item.reason}`);
  }

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. ' +
        'Set DRY_RUN=0 APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Write from `staged` rather than re-deriving from rows.rows: the dry-run output a reviewer
    // approved is exactly this list, and re-running the filters here is how the two drift.
    const stagedById = new Map(staged.map((item) => [item.entityId, item]));
    for (const row of rows.rows) {
      const draft = row.notes.draft;
      if (draft === undefined) continue;
      const plan = stagedById.get(row.entity_id);
      if (plan === undefined) continue;
      const summary = typeof draft.summary === 'string' ? draft.summary : undefined;
      if (summary === undefined || !summaryInBounds(draft)) continue;
      await client.query(
        `UPDATE research.landscape_candidates
            SET summary = $2,
                payload = payload || $3::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [
          row.entity_id,
          summary,
          JSON.stringify({
            // Explicit null clears prior narrative; an absent field preserves it. JSON
            // serialization must not erase that distinction during the payload merge.
            historicalContext:
              draft.historicalContext === null
                ? ''
                : typeof draft.historicalContext === 'string'
                  ? draft.historicalContext
                  : undefined,
            topicIds: Array.isArray(draft.topicIds) ? draft.topicIds : undefined,
            // An empty draft era list means the excerpt supplied no dates. Preserve previously
            // sourced eras; update eraBuckets only when the draft provides a nonempty list.
            eraBuckets:
              Array.isArray(draft.eraBuckets) && draft.eraBuckets.length > 0
                ? draft.eraBuckets
                : undefined,
            keywords: Array.isArray(draft.keywords) ? draft.keywords : undefined,
            evidenceCitations:
              plan.evidenceCitations.length > 0 ? plan.evidenceCitations : undefined,
          }),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(`\nApplied: ${staged.length} landscape_candidates row(s) staged with WS4 drafts.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
