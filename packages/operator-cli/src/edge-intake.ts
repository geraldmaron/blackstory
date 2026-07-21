/**
 * Edge intake: propose a new `EntityRelationship` through the existing operator
 * CLI/research-case pipeline (no parallel writer). Every proposal lands in the SAME quarantine
 * pipeline `./intake.ts`'s `prepareOperatorIntake` already uses (`createQuarantinedSubmission`,
 * `@repo/security`) and opens a draft research case exactly like `prepareLeadIntake` does.
 * This file adds no canonical write paths; it only shapes an `OperatorSubmission`
 * describing the proposed edge and calls the existing exported `prepareOperatorIntake`. Nothing
 * here writes an `entityRelationships` document directly — that stays the reviewer-gated
 * promotion path's job (see `./intake.ts`'s module doc).
 *
 * `caused`/`enabled` edges are hard-gated at THIS layer via `assertCausalEdgeGuardrail`
 * (`@repo/domain`). A `contested_or_single_incident` scope, or an omitted `causalReview`
 * altogether, is REJECTED here before the proposal ever reaches quarantine, with an explicit
 * instruction to submit via `cites` instead. Silence (no `causalReview` supplied) defaults to
 * rejection, never to permissiveness.
 */
import {
  assertCausalEdgeGuardrail,
  RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPES,
  relationshipRequiresTemporalContext,
  type CausalEdgeReview,
  type RelationshipRole,
  type RelationshipType,
  type TemporalContext,
} from '@repo/domain';
import {
  prepareOperatorIntake,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';

export type EdgeIntakeInput = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: RelationshipType;
  /** Only valid when `type === 'attended'` see `assertRelationshipRoleValidForType`. */
  readonly role?: RelationshipRole;
  readonly temporal?: TemporalContext;
  readonly notes?: string;
  readonly sourceUrls: readonly string[];
  /** Required for `caused`/`enabled`; ignored for every other
   * type. Omitting it for a `caused`/`enabled` proposal is a hard rejection, not a soft default. */
  readonly causalReview?: CausalEdgeReview;
  readonly submitterContact?: string;
};

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim().replace(/\s+/gu, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function deriveEdgeTitle(input: EdgeIntakeInput): string {
  const roleSuffix = input.role ? ` (role: ${input.role})` : '';
  return truncate(
    `Proposed relationship: ${input.fromEntityId} --${input.type}${roleSuffix}--> ${input.toEntityId}`,
    200,
  );
}

function composeEdgeStatement(input: EdgeIntakeInput): string {
  const lines = [
    `Proposed EntityRelationship: fromEntityId=${input.fromEntityId}, ` +
      `toEntityId=${input.toEntityId}, type=${input.type}` +
      (input.role ? `, role=${input.role}` : ''),
  ];
  if (input.temporal) {
    lines.push(
      `Temporal: validFrom=${input.temporal.validFrom ?? '(none)'}, ` +
        `validTo=${input.temporal.validTo === null ? '(open)' : (input.temporal.validTo ?? '(unset)')}` +
        (input.temporal.label ? `, label=${input.temporal.label}` : ''),
    );
  }
  if (input.causalReview) {
    lines.push(
      `Causal review scope: ${input.causalReview.scope}` +
        (input.causalReview.consensusBasis
          ? ` — consensus basis: ${input.causalReview.consensusBasis}`
          : ''),
    );
  }
  if (input.notes?.trim()) lines.push(input.notes.trim());
  return lines.join('\n\n');
}

function assertRecognizedType(type: RelationshipType): void {
  if (!(RELATIONSHIP_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unrecognized relationship type "${type}"`);
  }
}

function assertRecognizedRole(input: EdgeIntakeInput): void {
  if (input.role === undefined) return;
  if (input.type !== 'attended') {
    throw new Error(
      `Relationship role "${input.role}" is only valid on "attended" edges (got type "${input.type}")`,
    );
  }
  if (!(RELATIONSHIP_ROLES as readonly string[]).includes(input.role)) {
    throw new Error(`Unrecognized relationship role "${input.role}"`);
  }
}

function assertTemporalRequirement(input: EdgeIntakeInput): void {
  if (relationshipRequiresTemporalContext(input.type) && !input.temporal?.validFrom) {
    throw new Error(
      `Relationship type "${input.type}" is a historical-causation edge and requires a ` +
        'TemporalContext with at least validFrom.',
    );
  }
}

/**
 * Validates and prepares a proposed `EntityRelationship` for the same quarantine intake
 * path every other operator-cli proposal uses. Throws (fails closed) BEFORE calling into
 * quarantine when:
 * - `type` is not a recognized `RelationshipType` (fail closed on typos);
 * - `role` is set on a non-`attended` type, or is not a recognized `RelationshipRole`;
 * - a historical-causation type (`caused`/`enabled`/`influenced`/`overturned`) is missing a
 * `TemporalContext.validFrom`;
 * - `type` is `caused`/`enabled` and the causal-edge guardrail rejects the proposal
 * (always true when `causalReview` is omitted or its scope is
 * `contested_or_single_incident`).
 *
 * Downstream validation (title/statement length, source-URL requirements, rate limiting) is left
 * entirely to the real `createQuarantinedSubmission` — this delegates to. This function does not
 * duplicate that logic — only the edge-specific checks above that have no equivalent there.
 */
export function prepareEdgeIntake(
  input: EdgeIntakeInput,
  context: OperatorIntakeContext,
): OperatorIntakeOutcome {
  assertRecognizedType(input.type);
  assertRecognizedRole(input);
  assertTemporalRequirement(input);
  assertCausalEdgeGuardrail(
    input.type,
    input.causalReview ?? { scope: 'contested_or_single_incident' },
  );

  const title = deriveEdgeTitle(input);
  const submission = {
    kind: 'contribution' as const,
    title,
    statement: composeEdgeStatement(input),
    sourceUrls: input.sourceUrls,
    ...(input.submitterContact ? { submitterContact: input.submitterContact } : {}),
  };

  return prepareOperatorIntake('lead', submission, context, {
    openDraftCase: true,
    caseTitle: title,
  });
}
