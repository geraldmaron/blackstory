/**
 * LLM-assisted triage for the Postgres-backed intake quarantine (`bb_submissions.intake_items`,
 * status='quarantined'). This is the write path `graylist-read` (cli.ts) documented as missing.
 *
 * Judging and writing are split on purpose:
 *  - `judgeQuarantineItem` only calls the LLM and parses its answer. No I/O beyond the model call.
 *  - `prepareQuarantineTriageDecision` is pure: given a judgment, it decides what SQL a commit
 *    step would run, but performs no I/O itself.
 *  - `commitQuarantineTriagePlans` is the only function in this module that writes to Postgres.
 *
 * Authority stays inside what operator-cli already does elsewhere in this package (see
 * `intake.ts`'s header comment and `promotion-boundary.test.ts`): a 'case' decision opens a
 * real draft research case (`bb_research.cases`, `state: 'candidate'`) exactly like
 * `prepareLeadIntake` does for its own (Firestore-ledger) pipeline — it does not write
 * `bb_canonical.*`, evaluate a promotion gate, or otherwise decide anything is publishable.
 * A 'reject'/'spam' decision only updates `intake_items.status`. Every decision is logged to
 * `bb_audit.events` with the model's rationale so a human can review what happened.
 */
import { randomUUID } from 'node:crypto';
import type { getOpsPostgresPool } from '@repo/data-access';
import { createResearchCase, type ResearchCaseRecord } from '@repo/domain';
import type { LlmProvider } from './llm-provider.js';
import { buildOperatorActor, type OperatorIdentity } from './identity.js';

type Pool = ReturnType<typeof getOpsPostgresPool>;

export const QUARANTINE_TRIAGE_DECISIONS = ['case', 'reject', 'spam', 'needs_human'] as const;
export type QuarantineTriageDecision = (typeof QUARANTINE_TRIAGE_DECISIONS)[number];

/** The model only ever proposes one of these three the caller downgrades to 'needs_human'. */
export type QuarantineTriageModelDecision = Exclude<QuarantineTriageDecision, 'needs_human'>;

export type QuarantineIntakeItem = {
  readonly id: string;
  readonly kind: string | null;
  readonly payload: unknown;
  readonly sourceUrl: string | null;
  readonly createdAt: string;
};

export type QuarantineTriageJudgment = {
  readonly decision: QuarantineTriageModelDecision;
  readonly rationale: string;
  readonly confidence: number;
  readonly title?: string;
  readonly modelId: string;
  readonly provider: string;
};

export const QUARANTINE_TRIAGE_RESPONSE_SCHEMA = {
  name: 'quarantine_triage',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['decision', 'rationale', 'confidence'],
    properties: {
      decision: { type: 'string', enum: ['case', 'reject', 'spam'] },
      rationale: { type: 'string', minLength: 1, maxLength: 600 },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      title: { type: 'string', maxLength: 200 },
    },
  },
} as const;

const SYSTEM_PROMPT =
  'You triage quarantined public submissions to a Black history research catalog. ' +
  'Decide "case" only when the submission plausibly describes a real, specific, sourceable ' +
  'historical subject worth opening a research case for. Decide "spam" for promotional, ' +
  'incoherent, or automated-looking content. Decide "reject" for genuine but out-of-scope or ' +
  'unusable submissions (no verifiable subject, duplicate-looking, etc). Respond with strict ' +
  'JSON matching the given schema only never invent facts, never promise the subject is true.';

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function buildQuarantineTriagePrompt(
  item: QuarantineIntakeItem,
): readonly { readonly role: 'system' | 'user'; readonly content: string }[] {
  const payloadJson = truncate(JSON.stringify(item.payload ?? {}), 4000);
  const lines = [
    `intake_item id: ${item.id}`,
    `kind: ${item.kind ?? 'unknown'}`,
    `source_url: ${item.sourceUrl ?? 'none'}`,
    `created_at: ${item.createdAt}`,
    `payload: ${payloadJson}`,
  ];
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}

function isModelDecision(value: unknown): value is QuarantineTriageModelDecision {
  return value === 'case' || value === 'reject' || value === 'spam';
}

/** Calls the LLM for one item and validates its answer. Throws on malformed output. */
export async function judgeQuarantineItem(options: {
  readonly item: QuarantineIntakeItem;
  readonly provider: LlmProvider;
  readonly model: string;
}): Promise<QuarantineTriageJudgment> {
  const { item, provider, model } = options;
  const result = await provider.complete({
    messages: buildQuarantineTriagePrompt(item),
    model,
    responseSchema: QUARANTINE_TRIAGE_RESPONSE_SCHEMA,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch (error) {
    throw new Error(
      `quarantine-triage: model returned non-JSON output for ${item.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`quarantine-triage: model returned a non-object for ${item.id}`);
  }
  const record = parsed as Record<string, unknown>;
  if (!isModelDecision(record.decision)) {
    throw new Error(
      `quarantine-triage: model returned an invalid decision "${String(record.decision)}" for ${item.id}`,
    );
  }
  if (typeof record.rationale !== 'string' || record.rationale.trim().length === 0) {
    throw new Error(`quarantine-triage: model returned no rationale for ${item.id}`);
  }
  const confidence = typeof record.confidence === 'number' ? record.confidence : NaN;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`quarantine-triage: model returned an invalid confidence for ${item.id}`);
  }
  const title =
    typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined;
  return {
    decision: record.decision,
    rationale: record.rationale.trim(),
    confidence,
    ...(title ? { title } : {}),
    modelId: result.modelId,
    provider: result.provider,
  };
}

const NEXT_STATUS_BY_DECISION: Record<Exclude<QuarantineTriageDecision, 'needs_human'>, string> = {
  case: 'promoted',
  reject: 'rejected',
  spam: 'spam',
};

export type QuarantineCaseWrite = {
  readonly record: ResearchCaseRecord;
};

export type QuarantineTriagePlan = {
  readonly intakeItemId: string;
  readonly effectiveDecision: QuarantineTriageDecision;
  readonly judgment: QuarantineTriageJudgment;
  /** Present only when this decision writes anything (i.e. not 'needs_human'). */
  readonly write?: {
    readonly nextStatus: string;
    readonly caseWrite?: QuarantineCaseWrite;
    readonly auditReason: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Real `intake_items.payload` (built by `createQuarantinedSubmission` in `@repo/security`)
 * nests the submitter's title/statement under `payload.normalized`, not at the top level see
 * the envelope shape in `packages/security/src/quarantine.ts`. Fall back through `original`
 * and finally the flat shape in case an older/adapter-written row differs.
 */
function deriveTitle(item: QuarantineIntakeItem, judgment: QuarantineTriageJudgment): string {
  if (judgment.title) return judgment.title;
  const payload = asRecord(item.payload);
  const normalized = asRecord(payload?.normalized);
  const original = asRecord(asRecord(payload?.original)?.payload);
  const candidate =
    (typeof normalized?.title === 'string' && normalized.title) ||
    (typeof original?.title === 'string' && original.title) ||
    (typeof payload?.title === 'string' && payload.title) ||
    (typeof normalized?.statement === 'string' && normalized.statement) ||
    (typeof payload?.statement === 'string' && payload.statement) ||
    `Quarantined submission ${item.id}`;
  return (
    truncate(candidate.trim().replace(/\s+/gu, ' '), 200) || `Quarantined submission ${item.id}`
  );
}

/**
 * Pure: turns one judgment into a plan. Confidence below `confidenceThreshold` always downgrades
 * to 'needs_human' regardless of what the model decided nothing is written for those, and they
 * stay quarantined for a person to look at.
 */
export function prepareQuarantineTriageDecision(
  item: QuarantineIntakeItem,
  judgment: QuarantineTriageJudgment,
  options: { readonly confidenceThreshold: number; readonly nowIso: string },
): QuarantineTriagePlan {
  if (judgment.confidence < options.confidenceThreshold) {
    return { intakeItemId: item.id, effectiveDecision: 'needs_human', judgment };
  }
  const decision = judgment.decision;
  const nextStatus = NEXT_STATUS_BY_DECISION[decision];
  const caseWrite: QuarantineCaseWrite | undefined =
    decision === 'case'
      ? {
          record: createResearchCase({
            id: randomUUID(),
            candidateId: item.id,
            title: deriveTitle(item, judgment),
            checklist: { items: [] },
            now: options.nowIso,
          }),
        }
      : undefined;
  return {
    intakeItemId: item.id,
    effectiveDecision: decision,
    judgment,
    write: {
      nextStatus,
      ...(caseWrite ? { caseWrite } : {}),
      auditReason: `quarantine-triage(${judgment.provider}/${judgment.modelId}): ${judgment.rationale}`,
    },
  };
}

export type QuarantineTriageCommitSummary = {
  readonly committed: number;
  readonly skippedNeedsHuman: number;
  readonly skippedAlreadyProcessed: readonly string[];
};

/**
 * Writes each plan's decision inside its own transaction: update `intake_items.status`
 * (guarded so an item already moved out of 'quarantined' is left alone rather than double-
 * processed), optionally insert the new `bb_research.cases` row, and always record a
 * `bb_audit.events` row carrying the model's rationale.
 */
export async function commitQuarantineTriagePlans(
  pool: Pool,
  plans: readonly QuarantineTriagePlan[],
  identity: OperatorIdentity,
  nowIso: string = new Date().toISOString(),
): Promise<QuarantineTriageCommitSummary> {
  const actor = buildOperatorActor(identity);
  let committed = 0;
  const skippedAlreadyProcessed: string[] = [];
  const skippedNeedsHuman = plans.filter((plan) => plan.effectiveDecision === 'needs_human').length;

  for (const plan of plans) {
    if (!plan.write) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE bb_submissions.intake_items
            SET status = $1
          WHERE id = $2 AND status = 'quarantined'
        RETURNING id`,
        [plan.write.nextStatus, plan.intakeItemId],
      );
      if (updated.rowCount === 0) {
        await client.query('ROLLBACK');
        skippedAlreadyProcessed.push(plan.intakeItemId);
        continue;
      }
      if (plan.write.caseWrite) {
        const record = plan.write.caseWrite.record;
        await client.query(
          `INSERT INTO bb_research.cases (id, state, candidate_id, title, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            record.id,
            record.state,
            record.candidateId,
            record.title,
            record.createdAt,
            record.updatedAt,
          ],
        );
      }
      await client.query(
        `INSERT INTO bb_audit.events
           (id, action, category, actor, subject, reason, request_id, correlation_id,
            entity_id, idempotency_key, occurred_at, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(),
          'quarantine.triaged',
          'intake',
          JSON.stringify(actor),
          JSON.stringify({ type: 'intake_item', id: plan.intakeItemId }),
          plan.write.auditReason,
          randomUUID(),
          `quarantine-triage:${identity.sessionId}`,
          plan.write.caseWrite?.record.id ?? null,
          `quarantine-triage:${identity.sessionId}:${plan.intakeItemId}`,
          nowIso,
          JSON.stringify({
            decision: plan.effectiveDecision,
            confidence: plan.judgment.confidence,
            provider: plan.judgment.provider,
            modelId: plan.judgment.modelId,
            ...(plan.write.caseWrite ? { researchCaseId: plan.write.caseWrite.record.id } : {}),
          }),
        ],
      );
      await client.query('COMMIT');
      committed += 1;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { committed, skippedNeedsHuman, skippedAlreadyProcessed };
}
