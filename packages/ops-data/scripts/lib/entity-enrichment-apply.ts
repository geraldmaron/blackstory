/**
 * repo-n7p6.4 (WS4) — shared ledger write for every WS4 entry point (enrich-entities-llm.ts,
 * session-enrich-apply.ts). One place decides what an accepted or quarantined attempt writes to
 * bb_research.entity_enrichment, so an OpenRouter-drafted result and a session-drafted result
 * land in the ledger identically. NEVER writes to bb_public — publishing an accepted draft into
 * the release projection is WS5 (repo-n7p6.5), a separately gated step.
 */
import type pg from 'pg';
import { ENTITY_ENRICHMENT_SCHEMA_ID, ENTITY_ENRICHMENT_SCHEMA_VERSION, type EnrichmentAttempt } from './entity-enrichment-llm.ts';

/** Minimal query surface this module needs — satisfied by `pg.PoolClient` and `pg.Pool`. */
export type QueryableClient = Pick<pg.PoolClient, 'query'>;

export type ApplyEnrichmentResultInput = {
  readonly entityId: string;
  readonly attempt: EnrichmentAttempt;
  readonly modelId: string;
  /** 0 for a session-drafted answer (no metered API cost). */
  readonly costUsdEstimate: number;
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

function notesFor(attempt: EnrichmentAttempt): Record<string, unknown> {
  const base = { ws: 'repo-n7p6.4', schemaId: ENTITY_ENRICHMENT_SCHEMA_ID, schemaVersion: ENTITY_ENRICHMENT_SCHEMA_VERSION };
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
      JSON.stringify(notesFor(input.attempt)),
    ],
  );
}
