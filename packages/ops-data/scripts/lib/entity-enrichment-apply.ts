/**
 * repo-n7p6.4 (WS4) — shared ledger write for every WS4 entry point (enrich-entities-llm.ts,
 * session-enrich-apply.ts). One place decides what an accepted or quarantined attempt writes to
 * bb_research.entity_enrichment, so an OpenRouter-drafted result and a session-drafted result
 * land in the ledger identically. NEVER writes to bb_public — publishing an accepted draft into
 * the release projection is WS5 (repo-n7p6.5), a separately gated step.
 */
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ENTITY_ENRICHMENT_SCHEMA_ID, ENTITY_ENRICHMENT_SCHEMA_VERSION, type EnrichmentAttempt } from './entity-enrichment-llm.ts';

/**
 * repo-n7p6.16 item 5: deterministic random-sample selector for passing outputs. Hash-based
 * rather than Math.random so a re-run of the same batch (resume after interruption) selects the
 * same entities — the sample can't be dodged or double-counted by re-running. `salt` varies the
 * draw per batch (e.g. the run date) so the same entity isn't permanently in/out of the sample.
 */
export function isReviewSampled(entityId: string, rate: number, salt = ''): boolean {
  if (!(rate > 0)) return false;
  if (rate >= 1) return true;
  const digest = createHash('sha256').update(`${salt}:${entityId}`).digest();
  const draw = digest.readUInt32BE(0) / 0x1_0000_0000;
  return draw < rate;
}

/** Minimal query surface this module needs — satisfied by `pg.PoolClient` and `pg.Pool`. */
export type QueryableClient = Pick<pg.PoolClient, 'query'>;

export type ApplyEnrichmentResultInput = {
  readonly entityId: string;
  readonly attempt: EnrichmentAttempt;
  readonly modelId: string;
  /** 0 for a session-drafted answer (no metered API cost). */
  readonly costUsdEstimate: number;
  /**
   * repo-n7p6.16 item 5: a deterministically sampled PASSING output routed to review alongside
   * quarantined ones, so a validator/judge that starts waving through weak work is caught early.
   * The row keeps status='enriched' (it passed every deterministic check); reviewers pull the
   * queue with: status='quarantined' OR notes->'reviewSample'->>'selected' = 'true'.
   */
  readonly reviewSample?: boolean;
};

function fieldsWrittenFor(attempt: EnrichmentAttempt): readonly string[] {
  if (!attempt.validation.ok) return [];
  const draft = attempt.validation.draft;
  return [
    'summary',
    ...(draft.historicalContext !== null ? ['historicalContext'] : []),
    ...(draft.topicIds.length > 0 ? ['topicIds'] : []),
    ...(draft.eraBuckets.length > 0 ? ['eraBuckets'] : []),
    ...(draft.keywords.length > 0 ? ['keywords'] : []),
  ];
}

function notesFor(attempt: EnrichmentAttempt, reviewSample: boolean): Record<string, unknown> {
  const base = {
    ws: 'repo-n7p6.4',
    schemaId: ENTITY_ENRICHMENT_SCHEMA_ID,
    schemaVersion: ENTITY_ENRICHMENT_SCHEMA_VERSION,
    ...(reviewSample
      ? { reviewSample: { selected: true, reason: 'random-audit-of-passing-output' } }
      : {}),
  };
  return attempt.validation.ok
    ? { ...base, draft: attempt.validation.draft }
    : {
        ...base,
        validationErrors: attempt.validation.errors,
        rawContent: attempt.rawContent.slice(0, 4000),
      };
}

/** UPDATEs the entity's existing ledger row (WS3 must have INSERTed it already, status='pending'). */
export async function applyEnrichmentResult(
  client: QueryableClient,
  input: ApplyEnrichmentResultInput,
): Promise<void> {
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
      input.entityId,
      input.attempt.validation.ok ? 'enriched' : 'quarantined',
      input.modelId,
      input.costUsdEstimate,
      fieldsWrittenFor(input.attempt),
      JSON.stringify(notesFor(input.attempt, input.reviewSample === true)),
    ],
  );
}
