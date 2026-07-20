/**
 * The single exit from consensus review: turning an `auto_advance` routing decision into a
 * research case in its earliest `candidate` state. This is the "discovery candidate"
 * this lane is allowed to produce it seeds research (`../research-case`) and goes no
 * further. It never evaluates a promotion gate (`../promotion`), never constructs a
 * `PromotionClaim`, and never marks a case published; a case only reaches those later stages
 * through the standard research and promotion pipeline, same as any other
 * candidate. See `pending-changes-invariant.test.ts` for the boundary this function cannot
 * cross.
 */
import {
  createResearchCase,
  type EvidenceChecklist,
  type ResearchCaseRecord,
} from '../research-case/index.js';
import type { ConsensusRoutingDecision } from './types.js';

export type QuarantinedLeadSummary = {
  readonly submissionId: string;
  readonly title: string;
};

export type DiscoveryCandidateAdvancement = {
  readonly submissionId: string;
  readonly researchCase: ResearchCaseRecord;
  readonly consensus: ConsensusRoutingDecision;
};

const EMPTY_CHECKLIST: EvidenceChecklist = Object.freeze({ items: Object.freeze([]) });

/**
 * Builds the discovery-candidate research case for a lead whose consensus review
 * `auto_advance`d. Throws for any other routing status `expert_review`, `auto_reject`, and
 * `insufficient_reviews` must never reach a research case through this path.
 */
export function advanceToDiscoveryCandidate(input: {
  readonly decision: ConsensusRoutingDecision;
  readonly lead: QuarantinedLeadSummary;
  readonly researchCaseId: string;
  readonly now: string;
}): DiscoveryCandidateAdvancement {
  if (input.decision.status !== 'auto_advance') {
    throw new Error(
      `Only an auto_advance consensus decision may open a research case (received "${input.decision.status}")`,
    );
  }
  if (input.decision.submissionId !== input.lead.submissionId) {
    throw new Error('Consensus decision and lead summary target different submissions');
  }

  const researchCase = createResearchCase({
    id: input.researchCaseId,
    candidateId: input.lead.submissionId,
    title: input.lead.title,
    checklist: EMPTY_CHECKLIST,
    now: input.now,
  });

  return Object.freeze({
    submissionId: input.lead.submissionId,
    researchCase,
    consensus: input.decision,
  });
}
