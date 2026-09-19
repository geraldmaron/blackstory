/**
 * Shared enrichment-ledger writes for provider and externally supplied drafts. Deterministic
 * validation applies equally to both. Publication is a separate reviewed operation; this module
 * never writes published data.
 */
import { createHash } from 'node:crypto';
import type pg from 'pg';
import {
  ENTITY_ENRICHMENT_SCHEMA_ID,
  ENTITY_ENRICHMENT_SCHEMA_VERSION,
  type EnrichmentAttempt,
} from './entity-enrichment-llm.ts';

/**
 * Selects a stable review sample by entity id and batch salt. Resuming the same batch preserves
 * selection; changing the salt permits a new sample.
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
  /** NULL when original compute cost is unknown. */
  readonly costUsd: number | null;
  /**
   * Marks a deterministically sampled passing output for review without changing its enriched
   * status. Review queries include quarantined rows and notes.reviewSample.selected=true.
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
/**
 * Stores a no-lane-significance judgment against the exact evidence digest. New evidence
 * permits reopening. Misattached or absent evidence is an acquisition failure and must not
 * become a terminal significance judgment.
 */
export async function applyLaneSignificanceRefusal(
  client: QueryableClient,
  input: {
    readonly entityId: string;
    /** The drafter's stated reason — kept verbatim; it is the whole audit trail for the decision. */
    readonly reason: string;
    /** Digest of the evidence this judgment was made about. Null only if the row has none. */
    readonly evidenceDigest: string | null;
    readonly modelId: string;
  },
): Promise<void> {
  await client.query(
    `UPDATE research.entity_enrichment
        SET status = 'no-lane-significance',
            model_id = $2,
            evidence_digest = $3,
            notes = $4::jsonb,
            last_enriched_at = now(),
            updated_at = now()
      WHERE entity_id = $1`,
    [
      input.entityId,
      input.modelId,
      input.evidenceDigest,
      JSON.stringify({
        schemaId: ENTITY_ENRICHMENT_SCHEMA_ID,
        schemaVersion: ENTITY_ENRICHMENT_SCHEMA_VERSION,
        refusal: {
          kind: 'no-lane-significance',
          reason: input.reason,
          // Stated explicitly so a reader of this row never has to infer it: the evidence was
          // read and judged, it was not missing and it was not wrong.
          evidenceWasRead: true,
        },
      }),
    ],
  );
}

export async function applyEnrichmentResult(
  client: QueryableClient,
  input: ApplyEnrichmentResultInput,
): Promise<void> {
  await client.query(
    `UPDATE research.entity_enrichment
        SET status = $2,
            model_id = $3,
            cost_usd = CASE WHEN cost_usd IS NULL OR $4::numeric IS NULL THEN NULL ELSE cost_usd + $4 END,
            fields_written = $5,
            notes = $6::jsonb,
            last_enriched_at = now(),
            updated_at = now()
      WHERE entity_id = $1`,
    [
      input.entityId,
      input.attempt.validation.ok ? 'enriched' : 'quarantined',
      input.modelId,
      input.costUsd,
      fieldsWrittenFor(input.attempt),
      JSON.stringify(notesFor(input.attempt, input.reviewSample === true)),
    ],
  );
}
