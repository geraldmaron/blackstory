/**
 * repo-n7p6.4 (WS4) — cheap-model enrichment harness.
 *
 * Reads entities WS3 (sweep-entity-evidence.ts) already captured evidence for
 * (bb_research.entity_enrichment.status = 'pending'), asks a cheap OpenRouter model to draft a
 * summary/historicalContext/topicIds/eraBuckets/keywords bundle citing ONLY the supplied
 * evidence, and validates every citation deterministically before it is ever trusted:
 *   - length bounds (packages/schemas/src/public-projections.ts: summary 120-400 chars)
 *   - every citation quote must be a verbatim substring of the evidence text it names
 *   - topicIds only from the controlled taxonomy (packages/domain/src/taxonomy/topics.ts)
 *   - eraBuckets only well-formed, non-future decade labels
 *   - restricted-address properties and person entities (living/unknown by policy default) never
 *     get address-shaped tokens in the generated prose, independent of what the source evidence
 *     already redacted — the MODEL's output is what's checked here.
 *
 * A response that fails any check is quarantined (bb_research.entity_enrichment.status =
 * 'quarantined', full validation errors in notes) and NEVER retried automatically — the harness
 * runs each entity once per invocation. This script never writes to bb_public: publishing an
 * accepted draft into the release projection is WS5 (repo-n7p6.5), a separately gated step.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Provider (default mock — no network, no cost):
 *   ENRICH_ENTITIES_LLM_PROVIDER=mock|openrouter|ollama|hybrid
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/enrich-entities-llm.ts --lanes=nrhp-black-heritage --limit=20
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { TOPIC_REGISTRY } from '@repo/domain';
import { createLaneProvider, withLaneMetadata, type RoutedCompletion } from '../../operator-cli/src/model-routing.ts';
import type { LlmProvider } from '../../operator-cli/src/llm-provider.ts';
import { logModelInvocation } from '../../operator-cli/src/model-invocation-log.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildEnrichmentRequest,
  createMockEnrichmentProvider,
  validateEnrichmentResponse,
  ENTITY_ENRICHMENT_SCHEMA_ID,
  ENTITY_ENRICHMENT_SCHEMA_VERSION,
  type EnrichmentAttempt,
  type EnrichmentSubject,
} from './lib/entity-enrichment-llm.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.ENRICH_ENTITIES_LLM_APPLY === '1';
const PROVIDER_NAME = (process.env.ENRICH_ENTITIES_LLM_PROVIDER ?? 'mock') as
  'mock' | 'openrouter' | 'ollama' | 'hybrid';
/**
 * bb_research.model_invocations.activity_id is a hard FK to bb_research.agent_activities — this
 * script does not create cases/runs/activities (that ledger-write chain is repo-atya's scope,
 * same boundary extract-claim-date-qualifiers-llm.ts respects). Ad hoc CLI runs with no ledger
 * context skip DB logging; cost/quarantine are still reported to the console and the JSON report.
 */
const ACTIVITY_ID = process.env.ENRICH_ENTITIES_LLM_ACTIVITY_ID?.trim() || undefined;

const ALLOWED_TOPIC_IDS = TOPIC_REGISTRY.map((topic) => topic.id);
/** Per-source cap so one huge nomination form does not crowd out every other source. */
const MAX_CHARS_PER_SOURCE = 4_000;
/** Total evidence chars offered to the model, across all sources for one entity. */
const MAX_TOTAL_EVIDENCE_CHARS = 14_000;
/** Bounded batches (bead spec: "~250 entities"); override with --limit for smaller runs. */
const DEFAULT_LIMIT = 250;

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const LANES = flag('lanes', '')
  .split(',')
  .map((lane) => lane.trim())
  .filter((lane) => lane.length > 0);
const LIMIT = Number.parseInt(flag('limit', String(DEFAULT_LIMIT)), 10);
const CONCURRENCY = Math.max(1, Number.parseInt(flag('concurrency', '4'), 10));
const ENTITY_IDS = flag('entity-ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

const REPORT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.cache/entity-enrichment-llm');

type LedgerRow = {
  readonly entity_id: string;
  readonly lane: string | null;
  readonly evidence_digest: string | null;
};

type CandidateRow = {
  readonly id: string;
  readonly display_name: string;
  readonly payload: {
    readonly kind?: string;
    readonly restrictedAddress?: boolean;
  };
};

type EvidenceRow = {
  readonly id: string;
  readonly source_tier: 'tier1' | 'tier2' | 'lead';
  readonly title: string | null;
  readonly content_text: string | null;
};

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function runWorker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

function resolveProvider(): LlmProvider {
  if (PROVIDER_NAME === 'mock') return createMockEnrichmentProvider();
  return createLaneProvider('entity-depth-enrichment', { fetchImpl: fetch });
}

function buildEvidenceForModel(rows: readonly EvidenceRow[]): EnrichmentSubject['evidence'] {
  const usable = rows.filter((row) => row.content_text !== null && row.content_text.length > 0);
  // tier1 first (richest, most authoritative), then by length — matches WS3's own preference.
  const ordered = [...usable].sort((a, b) => {
    if (a.source_tier !== b.source_tier) return a.source_tier === 'tier1' ? -1 : 1;
    return (b.content_text?.length ?? 0) - (a.content_text?.length ?? 0);
  });
  const evidence: EnrichmentSubject['evidence'][number][] = [];
  let budget = MAX_TOTAL_EVIDENCE_CHARS;
  for (const row of ordered) {
    if (budget <= 0) break;
    const text = (row.content_text ?? '').slice(0, Math.min(MAX_CHARS_PER_SOURCE, budget));
    if (text.length === 0) continue;
    evidence.push({
      id: row.id,
      sourceTier: row.source_tier as 'tier1' | 'tier2',
      title: row.title,
      text,
    });
    budget -= text.length;
  }
  return evidence;
}

/** Same digest formula sweep-entity-evidence.ts uses, so "unchanged since WS3" is comparable. */
function evidenceDigest(rows: readonly { readonly content_hash: string | null }[]): string | null {
  const hashes = rows.map((row) => row.content_hash).filter((hash): hash is string => hash !== null);
  if (hashes.length === 0) return null;
  return createHash('sha256').update([...hashes].sort().join('|')).digest('hex');
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const ledgerParams: unknown[] = [];
  let laneClause = '';
  if (LANES.length > 0) {
    ledgerParams.push(LANES);
    laneClause = `AND lane = ANY($${ledgerParams.length}::text[])`;
  }
  let idClause = '';
  if (ENTITY_IDS.length > 0) {
    ledgerParams.push(ENTITY_IDS);
    idClause = `AND entity_id = ANY($${ledgerParams.length}::text[])`;
  }
  const ledgerRows = await pool.query<LedgerRow>(
    `SELECT entity_id, lane, evidence_digest
       FROM bb_research.entity_enrichment
      WHERE status = 'pending' ${laneClause} ${idClause}
      ORDER BY entity_id`,
    ledgerParams,
  );
  const targeted = ledgerRows.rows.slice(0, LIMIT);
  console.log(
    `Ledger has ${ledgerRows.rows.length} entit(ies) with status='pending' evidence` +
      `${LANES.length > 0 ? ` (lanes=${LANES.join(',')})` : ''}; processing ${targeted.length}` +
      `${targeted.length < ledgerRows.rows.length ? ` (--limit ${LIMIT})` : ''}.`,
  );
  if (targeted.length === 0) {
    await pool.end();
    return;
  }

  const candidateRows = await pool.query<CandidateRow>(
    `SELECT id, display_name, payload
       FROM bb_research.landscape_candidates
      WHERE id = ANY($1::text[])`,
    [targeted.map((row) => row.entity_id)],
  );
  const candidateById = new Map(candidateRows.rows.map((row) => [row.id, row]));

  const evidenceRows = await pool.query<EvidenceRow & { readonly entity_id: string; readonly content_hash: string | null }>(
    `SELECT entity_id, id, source_tier, title, content_text, content_hash
       FROM bb_research.entity_evidence
      WHERE entity_id = ANY($1::text[]) AND status = 'captured'`,
    [targeted.map((row) => row.entity_id)],
  );
  const evidenceByEntity = new Map<string, (EvidenceRow & { readonly content_hash: string | null })[]>();
  for (const row of evidenceRows.rows) {
    const list = evidenceByEntity.get(row.entity_id) ?? [];
    list.push(row);
    evidenceByEntity.set(row.entity_id, list);
  }

  const subjects: (EnrichmentSubject & { readonly evidenceDigest: string | null })[] = [];
  const skippedNoEvidence: string[] = [];
  for (const ledgerRow of targeted) {
    const candidate = candidateById.get(ledgerRow.entity_id);
    const evidenceRowsForEntity = evidenceByEntity.get(ledgerRow.entity_id) ?? [];
    const evidence = buildEvidenceForModel(evidenceRowsForEntity);
    if (evidence.length === 0 || candidate === undefined) {
      skippedNoEvidence.push(ledgerRow.entity_id);
      continue;
    }
    subjects.push({
      entityId: ledgerRow.entity_id,
      displayName: candidate.display_name,
      kind: candidate.payload.kind,
      lane: ledgerRow.lane ?? '',
      restrictedAddress: candidate.payload.restrictedAddress === true,
      evidence,
      evidenceDigest: evidenceDigest(evidenceRowsForEntity),
    });
  }
  if (skippedNoEvidence.length > 0) {
    console.log(
      `Skipping ${skippedNoEvidence.length} entit(ies) with status='pending' but no captured ` +
        `evidence row (ledger/evidence table drift): ${skippedNoEvidence.slice(0, 5).join(', ')}` +
        `${skippedNoEvidence.length > 5 ? '…' : ''}`,
    );
  }

  const provider = resolveProvider();
  const routed = withLaneMetadata('entity-depth-enrichment', provider);
  const model =
    PROVIDER_NAME === 'mock' ? 'mock-entity-enrichment-v1' : (process.env.OPENROUTER_MODEL?.trim() ?? '');

  console.log(`Provider: ${provider.id} (${PROVIDER_NAME})`);
  console.log(`Subjects with evidence: ${subjects.length}`);
  console.log(`Calling model at concurrency ${Math.min(CONCURRENCY, subjects.length)}...\n`);

  type Result = {
    readonly subject: (typeof subjects)[number];
    readonly attempt: EnrichmentAttempt;
    readonly completion: RoutedCompletion;
  };

  let completedCount = 0;
  const startedAt = Date.now();
  const results = await mapPool(subjects, CONCURRENCY, async (subject): Promise<Result> => {
    const request = buildEnrichmentRequest(subject, ALLOWED_TOPIC_IDS, model);
    const completion = await routed.complete(request);
    const attempt = validateEnrichmentResponse(subject, ALLOWED_TOPIC_IDS, completion.content);
    // Dry run must mean zero DB writes, full stop — model_invocations logging (like ledger
    // writes below) only happens on an actual apply, same boundary as extract-claim-date-
    // qualifiers-llm.ts's quarantineRejected.
    if (ACTIVITY_ID && !DRY_RUN && APPLY) {
      const promptHash = createHash('sha256')
        .update(request.messages.map((message) => message.content).join('\n'))
        .digest('hex');
      await logModelInvocation(pool, completion, {
        activityId: ACTIVITY_ID,
        promptHash,
        outputSchemaId: ENTITY_ENRICHMENT_SCHEMA_ID,
        outputSchemaVersion: ENTITY_ENRICHMENT_SCHEMA_VERSION,
        benchmarkVersion: 'entity-enrichment-v1',
        status: attempt.validation.ok ? 'valid' : 'invalid',
      });
    }
    completedCount += 1;
    const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
    const verdict = attempt.validation.ok ? 'accepted' : 'quarantined';
    const detail = attempt.validation.ok
      ? `$${completion.costUsdEstimate.toFixed(5)}`
      : attempt.validation.errors[0]?.slice(0, 80);
    console.log(
      `[${completedCount}/${subjects.length}] (${elapsedS}s) ${subject.entityId} ` +
        `(${subject.displayName}) — ${verdict} — ${detail}`,
    );
    return { subject, attempt, completion };
  });

  const accepted = results.filter((result) => result.attempt.validation.ok);
  const rejected = results.filter((result) => !result.attempt.validation.ok);
  const totalCost = results.reduce((sum, result) => sum + result.completion.costUsdEstimate, 0);

  console.log(`\nAccepted: ${accepted.length}`);
  console.log(`Quarantined: ${rejected.length}`);
  if (results.length > 0) {
    const rate = ((rejected.length / results.length) * 100).toFixed(1);
    console.log(`Quarantine rate: ${rate}%`);
  }
  console.log(
    `Total cost (this batch): $${totalCost.toFixed(4)} ` +
      `($${(totalCost / Math.max(1, results.length)).toFixed(5)}/entity avg)`,
  );

  for (const result of accepted.slice(0, 5)) {
    if (!result.attempt.validation.ok) continue;
    console.log(
      `  ✓ ${result.subject.entityId} (${result.subject.displayName}): ` +
        `"${result.attempt.validation.draft.summary.slice(0, 90)}…"`,
    );
  }
  if (accepted.length > 5) console.log(`  ...and ${accepted.length - 5} more accepted`);
  for (const result of rejected.slice(0, 5)) {
    if (result.attempt.validation.ok) continue;
    console.log(
      `  ✗ ${result.subject.entityId} (${result.subject.displayName}): ` +
        result.attempt.validation.errors.slice(0, 2).join('; '),
    );
  }
  if (rejected.length > 5) console.log(`  ...and ${rejected.length - 5} more quarantined`);

  const generatedAt = new Date().toISOString();
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `enrich-${generatedAt.replace(/[:.]/gu, '-')}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt,
        dryRun: DRY_RUN || !APPLY,
        provider: PROVIDER_NAME,
        lanes: LANES,
        subjectCount: subjects.length,
        acceptedCount: accepted.length,
        quarantinedCount: rejected.length,
        totalCostUsdEstimate: totalCost,
        results: results.map((result) => ({
          entityId: result.subject.entityId,
          displayName: result.subject.displayName,
          modelId: result.completion.modelId,
          costUsdEstimate: result.completion.costUsdEstimate,
          ok: result.attempt.validation.ok,
          draft: result.attempt.validation.ok ? result.attempt.validation.draft : undefined,
          errors: result.attempt.validation.ok ? undefined : result.attempt.validation.errors,
          rawContent: result.attempt.rawContent,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no ledger writes. Set DRY_RUN=0 ENRICH_ENTITIES_LLM_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const result of results) {
      const subject = result.subject;
      const fieldsWritten = result.attempt.validation.ok
        ? [
            'summary',
            ...(result.attempt.validation.draft.historicalContext !== null ? ['historicalContext'] : []),
            ...(result.attempt.validation.draft.topicIds.length > 0 ? ['topicIds'] : []),
            ...(result.attempt.validation.draft.eraBuckets.length > 0 ? ['eraBuckets'] : []),
            ...(result.attempt.validation.draft.keywords.length > 0 ? ['keywords'] : []),
          ]
        : [];
      const notes = result.attempt.validation.ok
        ? {
            ws: 'repo-n7p6.4',
            schemaId: ENTITY_ENRICHMENT_SCHEMA_ID,
            schemaVersion: ENTITY_ENRICHMENT_SCHEMA_VERSION,
            draft: result.attempt.validation.draft,
          }
        : {
            ws: 'repo-n7p6.4',
            schemaId: ENTITY_ENRICHMENT_SCHEMA_ID,
            schemaVersion: ENTITY_ENRICHMENT_SCHEMA_VERSION,
            validationErrors: result.attempt.validation.errors,
            rawContent: result.attempt.rawContent.slice(0, 4000),
          };
      await client.query(
        `UPDATE bb_research.entity_enrichment
            SET status = $2,
                model_id = $3,
                cost_usd = coalesce(cost_usd, 0) + $4,
                fields_written = $5,
                notes = $6::jsonb,
                last_enriched_at = now(),
                updated_at = now()
          WHERE entity_id = $1`,
        [
          subject.entityId,
          result.attempt.validation.ok ? 'enriched' : 'quarantined',
          result.completion.modelId,
          result.completion.costUsdEstimate,
          fieldsWritten,
          JSON.stringify(notes),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(`\nApplied: ${results.length} ledger row(s) updated (${accepted.length} enriched, ${rejected.length} quarantined).`);
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
