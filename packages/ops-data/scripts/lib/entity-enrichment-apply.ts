/**
 * repo-n7p6.4 (WS4) — shared ledger write for every WS4 entry point (enrich-entities-llm.ts,
 * session-enrich-apply.ts). One place decides what an accepted or quarantined attempt writes to
 * bb_research.entity_enrichment, so an OpenRouter-drafted result and a session-drafted result
 * land in the ledger identically. NEVER writes to bb_public — publishing an accepted draft into
 * the release projection is WS5 (repo-n7p6.5), a separately gated step.
 */
import { createHash } from 'node:crypto';
import type pg from 'pg';
import {
  ENTITY_ENRICHMENT_SCHEMA_ID,
  ENTITY_ENRICHMENT_SCHEMA_VERSION,
  type EnrichmentAttempt,
} from './entity-enrichment-llm.ts';

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
/**
 * repo-n9dq — the third outcome of a drafting pass, alongside accepted and quarantined.
 *
 * A drafter that reads captured, identity-verified evidence and finds no Black-history
 * significance in it is doing the right thing by refusing: the alternative is architectural
 * padding to clear the 120-char summary floor, which is the failure the whole enrichment effort
 * exists to undo. But until now a refusal wrote nothing, so the row stayed `pending` and every
 * later pass re-selected and re-spent on it. Wave 4's selection was 8 of wave 3's own refusals,
 * top of the list, because they still carried the most evidence by volume.
 *
 * `no-lane-significance` is terminal but NOT permanent, and `evidence_digest` is what makes the
 * difference. It records exactly which evidence was judged. A later sweep that captures a new
 * source changes the digest, and the row can be reopened by comparing the two — the refusal
 * expires when the input it was made about does, and not before.
 *
 * NOT to be used for a mis-attached document (repo-pjob). "This evidence says nothing about Black
 * history" and "this evidence is about a different subject entirely" look identical to a drafter
 * and are opposite facts: the first is a finished judgement about the entity, the second is a
 * retrieval bug where the entity was never researched at all. Marking the second terminal would
 * permanently close a record whose real nomination was simply never fetched. Those belong in the
 * identity gate and leave the row with no captured evidence at all.
 */
export async function applyLaneSignificanceRefusal(
  client: QueryableClient,
  input: {
    readonly entityId: string;
    /** The drafter's stated reason — kept verbatim; it is the whole audit trail for the decision. */
    readonly reason: string;
    /** Digest of the evidence this judgement was made about. Null only if the row has none. */
    readonly evidenceDigest: string | null;
    readonly modelId: string;
  },
): Promise<void> {
  await client.query(
    `UPDATE bb_research.entity_enrichment
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
