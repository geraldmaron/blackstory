/**
 * Drafts entity enrichment from captured evidence and stages validated proposals.
 * External dispatch requires --max-call-cost-usd covering every internal provider attempt.
 * Reservations are never released by this batch; unknown billing is reported explicitly.
 * Production writes require DRY_RUN=0 and ENRICH_ENTITIES_LLM_APPLY=1.
 * Independent evidence review and publication remain separate operations.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { TOPIC_REGISTRY } from '@repo/domain';
import {
  createLaneProvider,
  withLaneMetadata,
  type RoutedCompletion,
} from '../../operator-cli/src/model-routing.ts';
import {
  createHybridLlmProvider,
  createOpenRouterLlmProvider,
  type LlmProvider,
} from '../../operator-cli/src/llm-provider.ts';
import { DEFAULT_STORY_REWRITE_MODELS } from '../../operator-cli/src/story-rewrite.ts';
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
import { applyEnrichmentResult, isReviewSampled } from './lib/entity-enrichment-apply.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.ENRICH_ENTITIES_LLM_APPLY === '1';
const PROVIDER_NAME = (process.env.ENRICH_ENTITIES_LLM_PROVIDER ?? 'mock') as
  'mock' | 'openrouter' | 'ollama' | 'hybrid' | 'tiered';
/**
 * Fraction of deterministically selected passing outputs routed to review.
 */
const REVIEW_SAMPLE_RATE = Number.parseFloat(
  process.env.ENRICH_REVIEW_SAMPLE_RATE?.trim() || '0.05',
);
/** Model id recorded for tier-0 session answers (mirrors session-enrich-apply.ts). */
const SESSION_MODEL_ID =
  process.env.SESSION_ENRICH_MODEL_ID?.trim() || 'claude-haiku-4-5-20251001-session';
/**
 * Invocation logging requires an existing agent activity because activity_id is a foreign key.
 * This script does not create that execution context; callers without it receive console/JSON
 * accounting only. Use the durable research worker protocol when resumable run accounting is
 * required.
 */
const ACTIVITY_ID = process.env.ENRICH_ENTITIES_LLM_ACTIVITY_ID?.trim() || undefined;

const ALLOWED_TOPIC_IDS = TOPIC_REGISTRY.map((topic) => topic.id);
/** Bounded batches (bead spec: "~250 entities"); override with --limit for smaller runs. */
const DEFAULT_LIMIT = 250;

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

/** Worst-case reservations must fit this batch budget before provider dispatch. */
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
/** Tier 0 (PROVIDER=tiered): session-drafted answers consumed before any model call. */
const SESSION_ANSWERS_PATH = flag('session-answers', '');

function loadSessionAnswers(path: string): ReadonlyMap<string, string> {
  if (!path) return new Map();
  const answers = new Map<string, string>();
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    const parsed = JSON.parse(line) as { entityId?: unknown; rawContent?: unknown };
    if (typeof parsed.entityId !== 'string' || typeof parsed.rawContent !== 'string') {
      throw new Error(`--session-answers line ${index + 1}: missing entityId or rawContent`);
    }
    answers.set(parsed.entityId, parsed.rawContent);
  }
  return answers;
}

const REPORT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.cache/entity-enrichment-llm',
);

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
  if (PROVIDER_NAME === 'tiered') {
    // Tiers 1+2: free OpenRouter roster with local Ollama failover. The hybrid provider already
    // treats an error-free non-JSON response (reasoning-model chain-of-thought) as a failure
    // worth failing over, which a naive fallback-on-error would miss.
    return createHybridLlmProvider({ fetchImpl: fetch });
  }
  return createLaneProvider('entity-depth-enrichment', { fetchImpl: fetch });
}

/** Tier 3 (PROVIDER=tiered): metered paid roster, used ONLY for quarantine retries. */
function resolveMeteredRetryProvider(): LlmProvider | null {
  if (PROVIDER_NAME !== 'tiered') return null;
  return createOpenRouterLlmProvider({
    fetchImpl: fetch,
    models: [...DEFAULT_STORY_REWRITE_MODELS],
    maxAttempts: 2,
  });
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
       FROM research.entity_enrichment
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
    PROVIDER_NAME === 'mock'
      ? 'mock-entity-enrichment-v1'
      : (process.env.OPENROUTER_MODEL?.trim() ?? '');

  console.log(`Provider: ${provider.id} (${PROVIDER_NAME})`);
  console.log(`Subjects with evidence: ${subjects.length}`);
  console.log(`Calling model at concurrency ${Math.min(CONCURRENCY, subjects.length)}...\n`);

  type Result = {
    readonly subject: (typeof subjects)[number];
    readonly attempt: EnrichmentAttempt;
    readonly completion: RoutedCompletion;
    readonly servedByTier: 'session' | 'free-or-ollama' | 'metered-retry' | 'single-provider';
    readonly reviewSample: boolean;
    readonly firstAttemptErrors?: readonly string[];
  };

  const sessionAnswers = loadSessionAnswers(SESSION_ANSWERS_PATH);
  if (SESSION_ANSWERS_PATH) {
    console.log(
      `Tier 0: ${sessionAnswers.size} session answer(s) loaded from ${SESSION_ANSWERS_PATH}`,
    );
  }
  const meteredRetryProvider = resolveMeteredRetryProvider();
  const meteredRouted =
    meteredRetryProvider === null
      ? null
      : withLaneMetadata('entity-depth-enrichment', meteredRetryProvider);
  /** Salted per run-date so the same entity isn't permanently in/out of the audit sample. */
  const sampleSalt = new Date().toISOString().slice(0, 10);

  let completedCount = 0;
  let reservedCostUsd = 0;
  let incompleteCalls = 0;
  const maxCallCostUsd = Number(flag('max-call-cost-usd', 'NaN'));
  if (PROVIDER_NAME !== 'mock' && (!Number.isFinite(maxCallCostUsd) || maxCallCostUsd <= 0)) {
    throw new Error('--max-call-cost-usd must bound all provider retries before dispatch');
  }
  if (!Number.isFinite(SPEND_CEILING_USD) || SPEND_CEILING_USD < 0)
    throw new Error('Invalid spend ceiling');
  const reserveCall = (): boolean => {
    if (PROVIDER_NAME === 'mock') return true;
    if (reservedCostUsd + maxCallCostUsd > SPEND_CEILING_USD) return false;
    reservedCostUsd += maxCallCostUsd;
    return true;
  };
  const observeCost = (completion: RoutedCompletion): void => {
    if (completion.accounting?.incomplete !== false) incompleteCalls += 1;
    if (completion.costUsd !== null && completion.costUsd > maxCallCostUsd) {
      reservedCostUsd = SPEND_CEILING_USD;
      console.error(
        'Reported charge exceeded the declared call bound; further dispatch is stopped.',
      );
    }
  };
  const skippedForCeiling: string[] = [];
  const startedAt = Date.now();
  const results = await mapPool(subjects, CONCURRENCY, async (subject): Promise<Result | null> => {
    // Supplied drafts do not dispatch a provider call; their original compute cost is unknown.
    const sessionAnswer = sessionAnswers.get(subject.entityId);
    let sessionAttemptErrors: readonly string[] | undefined;
    if (sessionAnswer !== undefined) {
      const attempt = validateEnrichmentResponse(subject, ALLOWED_TOPIC_IDS, sessionAnswer);
      if (attempt.validation.ok) {
        completedCount += 1;
        const reviewSample = isReviewSampled(subject.entityId, REVIEW_SAMPLE_RATE, sampleSalt);
        console.log(
          `[${completedCount}/${subjects.length}] ${subject.entityId} (${subject.displayName}) ` +
            `— validated proposal — supplied draft (cost unknown)${reviewSample ? ' [review sample]' : ''}`,
        );
        return {
          subject,
          attempt,
          completion: {
            content: sessionAnswer,
            modelId: SESSION_MODEL_ID,
            provider: 'session',
            lane: 'entity-depth-enrichment',
            tier: 'trusted-session',
            costUsd: null,
          } as RoutedCompletion,
          servedByTier: 'session',
          reviewSample,
        };
      }
      sessionAttemptErrors = attempt.validation.errors;

      // Invalid supplied drafts must never be replaced with synthetic model output.
      if (PROVIDER_NAME === 'mock') {
        completedCount += 1;
        console.log(
          `[${completedCount}/${subjects.length}] ${subject.entityId} (${subject.displayName}) ` +
            `— SESSION DRAFT REJECTED, not substituting mock output: ` +
            `${attempt.validation.errors.slice(0, 2).join('; ')}`,
        );
        return null;
      }
    }

    if (!reserveCall()) {
      skippedForCeiling.push(subject.entityId);
      completedCount += 1;
      console.log(
        `[${completedCount}/${subjects.length}] ${subject.entityId} — SKIPPED — ` +
          `spend ceiling reached ($${reservedCostUsd.toFixed(4)} >= $${SPEND_CEILING_USD.toFixed(2)})`,
      );
      return null;
    }
    const request = buildEnrichmentRequest(subject, ALLOWED_TOPIC_IDS, model);
    let completion = await routed.complete(request);
    observeCost(completion);
    let attempt = validateEnrichmentResponse(subject, ALLOWED_TOPIC_IDS, completion.content);
    let servedByTier: Result['servedByTier'] =
      PROVIDER_NAME === 'tiered' ? 'free-or-ollama' : 'single-provider';
    let firstAttemptErrors: readonly string[] | undefined = sessionAttemptErrors;
    // Tier 3 (tiered only): one metered retry for a validation failure, ceiling-gated.
    if (!attempt.validation.ok && meteredRouted !== null && reserveCall()) {
      firstAttemptErrors = [...(firstAttemptErrors ?? []), ...attempt.validation.errors];
      const retryCompletion = await meteredRouted.complete(request);
      observeCost(retryCompletion);
      const retryAttempt = validateEnrichmentResponse(
        subject,
        ALLOWED_TOPIC_IDS,
        retryCompletion.content,
      );
      if (retryAttempt.validation.ok) {
        completion = retryCompletion;
        attempt = retryAttempt;
        servedByTier = 'metered-retry';
      }
    }
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
    const reviewSample =
      attempt.validation.ok && isReviewSampled(subject.entityId, REVIEW_SAMPLE_RATE, sampleSalt);
    const verdict = attempt.validation.ok ? 'accepted' : 'quarantined';
    const detail = attempt.validation.ok
      ? (completion.costUsd === null ? 'cost unknown' : `$${completion.costUsd.toFixed(5)}`) +
        (servedByTier === 'metered-retry' ? ' (metered retry)' : '') +
        (reviewSample ? ' [review sample]' : '')
      : attempt.validation.errors[0]?.slice(0, 80);
    console.log(
      `[${completedCount}/${subjects.length}] (${elapsedS}s) ${subject.entityId} ` +
        `(${subject.displayName}) — ${verdict} — ${detail}`,
    );
    return {
      subject,
      attempt,
      completion,
      servedByTier,
      reviewSample,
      ...(firstAttemptErrors !== undefined ? { firstAttemptErrors } : {}),
    };
  });

  if (skippedForCeiling.length > 0) {
    console.log(
      `\nSpend ceiling reached: skipped ${skippedForCeiling.length}/${subjects.length} ` +
        `entit(ies) (final cumulative cost $${reservedCostUsd.toFixed(4)} vs ` +
        `$${SPEND_CEILING_USD.toFixed(2)} ceiling): ${skippedForCeiling.slice(0, 10).join(', ')}` +
        `${skippedForCeiling.length > 10 ? '…' : ''}`,
    );
  }
  const completedResults = results.filter((result): result is Result => result !== null);

  const accepted = completedResults.filter((result) => result.attempt.validation.ok);
  const rejected = completedResults.filter((result) => !result.attempt.validation.ok);
  const totalCost = completedResults.reduce(
    (sum, result) => sum + (result.completion.costUsd ?? 0),
    0,
  );
  const sampled = accepted.filter((result) => result.reviewSample);

  console.log(`\nAccepted: ${accepted.length}`);
  console.log(`Quarantined: ${rejected.length}`);
  if (PROVIDER_NAME === 'tiered') {
    const byTier = new Map<string, number>();
    for (const result of completedResults) {
      byTier.set(result.servedByTier, (byTier.get(result.servedByTier) ?? 0) + 1);
    }
    console.log(
      `Tier breakdown: ${[...byTier.entries()].map(([tier, n]) => `${tier}=${n}`).join(', ')}`,
    );
  }
  if (sampled.length > 0) {
    console.log(
      `Review sample (${(REVIEW_SAMPLE_RATE * 100).toFixed(0)}% of passing): ` +
        sampled.map((result) => result.subject.entityId).join(', '),
    );
  }
  if (completedResults.length > 0) {
    const rate = ((rejected.length / completedResults.length) * 100).toFixed(1);
    console.log(`Quarantine rate: ${rate}%`);
  }
  console.log(
    `Known reported cost (this batch): $${totalCost.toFixed(4)}; incomplete calls: ${incompleteCalls} ` +
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
        reviewSampleRate: REVIEW_SAMPLE_RATE,
        reviewSampledEntityIds: sampled.map((result) => result.subject.entityId),
        results: completedResults.map((result) => ({
          entityId: result.subject.entityId,
          displayName: result.subject.displayName,
          modelId: result.completion.modelId,
          costUsd: result.completion.costUsd,
          servedByTier: result.servedByTier,
          reviewSample: result.reviewSample,
          ...(result.firstAttemptErrors !== undefined
            ? { firstAttemptErrors: result.firstAttemptErrors }
            : {}),
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
        costUsd: result.completion.costUsd,
        reviewSample: result.reviewSample,
      });
    }
    await client.query('COMMIT');
    console.log(
      `\nApplied: ${completedResults.length} ledger row(s) updated (${accepted.length} enriched, ${rejected.length} quarantined).`,
    );
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
