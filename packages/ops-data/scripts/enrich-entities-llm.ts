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
 * Spend ceiling (repo-n7p6.16 item 3): once cumulative metered cost for this batch reaches
 * ENRICH_ENTITIES_LLM_SPEND_CEILING_USD (default 3), no further model calls are started —
 * remaining subjects are skipped and reported, not silently dropped.
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
} from './lib/entity-enrichment-llm.ts';
import { fetchEnrichmentSubjects } from './lib/entity-enrichment-fetch.ts';
import { applyEnrichmentResult } from './lib/entity-enrichment-apply.ts';

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
/** Bounded batches (bead spec: "~250 entities"); override with --limit for smaller runs. */
const DEFAULT_LIMIT = 250;

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

/**
 * repo-n7p6.16 item 3: a hard ceiling on cumulative metered spend for this batch, enforced in
 * code rather than relying on an operator watching the console total. Checked before each call
 * starts, not after, so it can only ever ABORT further calls — it never cancels one in flight.
 * With CONCURRENCY calls able to be in flight when the ceiling is crossed, actual spend can
 * overshoot the ceiling by at most (CONCURRENCY - 1) call costs; that bound is acceptable for a
 * batch of small per-call costs and is logged explicitly when it happens.
 */
const SPEND_CEILING_USD = Number.parseFloat(
  process.env.ENRICH_ENTITIES_LLM_SPEND_CEILING_USD?.trim() || '3',
);

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
    `SELECT entity_id
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

  const { subjects, skippedNoEvidence } = await fetchEnrichmentSubjects(
    pool,
    targeted.map((row) => row.entity_id),
  );
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
  let cumulativeCostUsd = 0;
  const skippedForCeiling: string[] = [];
  const startedAt = Date.now();
  const results = await mapPool(subjects, CONCURRENCY, async (subject): Promise<Result | null> => {
    if (cumulativeCostUsd >= SPEND_CEILING_USD) {
      skippedForCeiling.push(subject.entityId);
      completedCount += 1;
      console.log(
        `[${completedCount}/${subjects.length}] ${subject.entityId} — SKIPPED — ` +
          `spend ceiling reached ($${cumulativeCostUsd.toFixed(4)} >= $${SPEND_CEILING_USD.toFixed(2)})`,
      );
      return null;
    }
    const request = buildEnrichmentRequest(subject, ALLOWED_TOPIC_IDS, model);
    const completion = await routed.complete(request);
    cumulativeCostUsd += completion.costUsdEstimate;
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

  if (skippedForCeiling.length > 0) {
    console.log(
      `\nSpend ceiling reached: skipped ${skippedForCeiling.length}/${subjects.length} ` +
        `entit(ies) (final cumulative cost $${cumulativeCostUsd.toFixed(4)} vs ` +
        `$${SPEND_CEILING_USD.toFixed(2)} ceiling): ${skippedForCeiling.slice(0, 10).join(', ')}` +
        `${skippedForCeiling.length > 10 ? '…' : ''}`,
    );
  }
  const completedResults = results.filter((result): result is Result => result !== null);

  const accepted = completedResults.filter((result) => result.attempt.validation.ok);
  const rejected = completedResults.filter((result) => !result.attempt.validation.ok);
  const totalCost = completedResults.reduce((sum, result) => sum + result.completion.costUsdEstimate, 0);

  console.log(`\nAccepted: ${accepted.length}`);
  console.log(`Quarantined: ${rejected.length}`);
  if (completedResults.length > 0) {
    const rate = ((rejected.length / completedResults.length) * 100).toFixed(1);
    console.log(`Quarantine rate: ${rate}%`);
  }
  console.log(
    `Total cost (this batch): $${totalCost.toFixed(4)} ` +
      `($${(totalCost / Math.max(1, completedResults.length)).toFixed(5)}/entity avg)`,
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
        skippedForSpendCeiling: skippedForCeiling,
        spendCeilingUsd: SPEND_CEILING_USD,
        totalCostUsdEstimate: totalCost,
        results: completedResults.map((result) => ({
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
    for (const result of completedResults) {
      await applyEnrichmentResult(client, {
        entityId: result.subject.entityId,
        attempt: result.attempt,
        modelId: result.completion.modelId,
        costUsdEstimate: result.completion.costUsdEstimate,
      });
    }
    await client.query('COMMIT');
    console.log(`\nApplied: ${completedResults.length} ledger row(s) updated (${accepted.length} enriched, ${rejected.length} quarantined).`);
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
