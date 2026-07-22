/**
 * get_law_timeline — heritage-lane helper stub (published entity + relationships).
 * Phase 1 returns an empty timeline with implementation guidance; no auto-attached impact.
 */
import type { GetLawTimelineInput } from '../types.js';
import { OperatorMcpError } from '../errors.js';
import { assertNoForbiddenCausalRequest } from './causal-guard.js';

export type LawTimelineEntry = {
  readonly entityId: string;
  readonly title: string;
  readonly entityKind: 'law' | 'case' | 'policy';
  readonly enactmentClaim: string | null;
  readonly repealClaim: string | null;
  readonly citationHref: string | null;
  readonly confidenceLabel: string;
};

export async function getLawTimeline(
  input: GetLawTimelineInput,
): Promise<{
  readonly timeline: readonly LawTimelineEntry[];
  readonly status: 'stub';
  readonly message: string;
}> {
  assertNoForbiddenCausalRequest(input as unknown as Record<string, unknown>);

  if (!input.entityId && !(input.topicId && input.stateFips)) {
    throw new OperatorMcpError(
      'invalid_input',
      'Provide entityId or both topicId and stateFips',
    );
  }

  return {
    timeline: [],
    status: 'stub',
    message:
      'Law timeline reads from published heritage entities are not wired in Phase 1. Use operator-cli / PostgREST published views for entity claims; this tool will wrap ADR-026 read surfaces in a follow-up bead.',
  };
}
