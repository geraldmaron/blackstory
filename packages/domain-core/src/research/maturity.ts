/**
 * Research maturity: how well researched a record is, derived from its evidence.
 *
 * This is NOT confidence and NOT completeness.
 *
 *   Confidence  — how strong the evidence for one claim is, given what was assessed.
 *   Completeness — how many rendered fields are populated. A real question, answered elsewhere.
 *   Maturity     — whether the research was actually done.
 *
 * Conflating the third with the second is how a catalog reaches 4,167 published records where
 * 84% cite exactly one source and every one of them looks finished. A record can be complete
 * and unresearched: every field populated from one templated import.
 *
 * Maturity is DERIVED, always. There is deliberately no way to set it. An operator who could
 * mark a record `reference` would eventually do so under deadline, and the state would come to
 * mean "someone said so" — which is the thing this replaces.
 *
 * `reference` does not mean finished. A later source can reopen any record, and the model has
 * no state above it precisely so that nothing reads as permanent.
 */
import {
  type EnrichmentPriority,
  type RecordSnapshot,
  type ResearchDeficit,
  type ResearchDeficitCode,
  corroboratingLineageKeys,
  detectDeficits,
  enrichmentPriority,
} from './deficits.js';
import { assessSourceFitness, isHighImpactAssertion } from '../claims/source-fitness.js';

export const RESEARCH_MATURITY_STATES = [
  'seeded',
  'grounded',
  'corroborated',
  'contextualized',
  'deep_research',
  'reference',
] as const;
export type ResearchMaturity = (typeof RESEARCH_MATURITY_STATES)[number];

export const RESEARCH_GATE_IDS = [
  'identity_resolved',
  'has_traceable_source',
  'summary_claims_have_evidence',
  'summary_not_bridge_only',
  'sources_fit_their_claims',
  'high_impact_corroborated',
  'superlatives_scoped',
  'contradiction_search_complete',
  'place_anchored',
  'relationships_evidenced',
  'primary_receipt_held',
  'source_diversity',
  'lineage_understood',
  'prior_art_searched',
  'selectors_on_key_evidence',
  'independently_reviewed',
  'no_open_mandatory_needs',
] as const;
export type ResearchGateId = (typeof RESEARCH_GATE_IDS)[number];

export type ResearchBlocker = {
  readonly gate: ResearchGateId;
  /** The state this gate stands between the record and. */
  readonly blocks: ResearchMaturity;
  readonly explanation: string;
  readonly remediation: string;
  readonly claimId?: string | undefined;
};

export type ResearchMaturityAssessment = {
  readonly maturity: ResearchMaturity;
  readonly satisfiedGates: readonly ResearchGateId[];
  readonly blockers: readonly ResearchBlocker[];
  readonly evidenceDeficits: readonly ResearchDeficit[];
  readonly priority: EnrichmentPriority;
  readonly evaluatedAt: string;
  readonly evaluatorVersion: string;
};

/**
 * Bumped whenever a gate's meaning changes, so a stored assessment can be told apart from one
 * this version would produce. A stored maturity from an older evaluator is a historical record
 * of what was believed, not a current finding.
 */
export const RESEARCH_EVALUATOR_VERSION = '1.0.0';

export type MaturityEvaluationInput = {
  readonly record: RecordSnapshot;
  /** Identity resolution is upstream of this evaluator; it reports what it was told. */
  readonly identityResolved: boolean;
  /** Mandatory evidence needs still open, by name, for the deep_research and reference gates. */
  readonly openMandatoryNeeds?: readonly string[] | undefined;
  /**
   * An independent review by an actor distinct from the one that produced the record. Producer
   * and reviewer being the same actor is not review; the kernel already refuses it for approvals
   * and the same rule governs `reference`.
   */
  readonly independentReview?:
    | {
        readonly reviewerActorId: string;
        readonly producerActorId: string;
        readonly correctionForcingFindings: number;
      }
    | undefined;
  readonly evaluatedAt?: string | undefined;
};

function blocker(
  gate: ResearchGateId,
  blocks: ResearchMaturity,
  explanation: string,
  remediation: string,
  claimId?: string,
): ResearchBlocker {
  return { gate, blocks, explanation, remediation, claimId };
}

const DEFICITS_BLOCKING: Readonly<Partial<Record<ResearchDeficitCode, ResearchGateId>>> = {
  wikipedia_only_summary_claim: 'summary_not_bridge_only',
  bridge_only_entity: 'summary_not_bridge_only',
  claim_source_unfit_for_claim: 'sources_fit_their_claims',
  single_lineage_high_impact_claim: 'high_impact_corroborated',
  superlative_without_institutional_support: 'superlatives_scoped',
  superlative_source_does_not_state_scope: 'superlatives_scoped',
  unresolved_contradiction: 'contradiction_search_complete',
  contradiction_search_not_run: 'contradiction_search_complete',
  missing_place_receipt: 'place_anchored',
  missing_relationship_evidence: 'relationships_evidenced',
  no_primary_or_archival_receipt: 'primary_receipt_held',
  source_type_monoculture: 'source_diversity',
  importer_source_monoculture: 'source_diversity',
  host_based_lineage_suspect: 'lineage_understood',
  duplicate_upstream_lineage: 'lineage_understood',
  high_impact_attribution_without_prior_art_search: 'prior_art_searched',
  claim_without_evidence_selector: 'selectors_on_key_evidence',
  invention_claim_without_technical_receipt: 'primary_receipt_held',
  missing_identity_receipt: 'sources_fit_their_claims',
  patent_used_as_racial_identity_evidence: 'sources_fit_their_claims',
};

/** Which maturity state each gate stands between the record and. */
const GATE_LEVEL: Readonly<Record<ResearchGateId, ResearchMaturity>> = {
  identity_resolved: 'seeded',
  has_traceable_source: 'seeded',
  summary_claims_have_evidence: 'grounded',
  summary_not_bridge_only: 'grounded',
  sources_fit_their_claims: 'grounded',
  high_impact_corroborated: 'corroborated',
  superlatives_scoped: 'corroborated',
  contradiction_search_complete: 'corroborated',
  place_anchored: 'contextualized',
  relationships_evidenced: 'contextualized',
  primary_receipt_held: 'deep_research',
  source_diversity: 'deep_research',
  lineage_understood: 'deep_research',
  prior_art_searched: 'deep_research',
  selectors_on_key_evidence: 'deep_research',
  independently_reviewed: 'reference',
  no_open_mandatory_needs: 'reference',
};

const ORDER: readonly ResearchMaturity[] = RESEARCH_MATURITY_STATES;

/**
 * Assess a record's research maturity.
 *
 * The record earns the highest state whose gates — and every lower state's gates — are clear.
 * A single blocker at `grounded` caps the record at `seeded` however much evidence sits above
 * it, because depth built on an unsupported summary is depth on sand.
 */
export function assessResearchMaturity(input: MaturityEvaluationInput): ResearchMaturityAssessment {
  const { record } = input;
  const deficits = detectDeficits(record);
  const blockers: ResearchBlocker[] = [];

  // ---- seeded ----
  if (!input.identityResolved) {
    blockers.push(
      blocker(
        'identity_resolved',
        'seeded',
        'The canonical identity of this record is unresolved.',
        'Resolve identity through the verification lane before researching further; evidence attached to the wrong subject is worse than none.',
      ),
    );
  }
  const allEvidence = record.claims.flatMap((claim) => claim.evidence);
  const acceptedClaims = record.claims.length;
  if (acceptedClaims === 0 || allEvidence.length === 0) {
    blockers.push(
      blocker(
        'has_traceable_source',
        'seeded',
        'The record has no accepted claim with a traceable source.',
        'Attach at least one claim supported by a source that can be found again.',
      ),
    );
  }

  // ---- grounded ----
  const summaryClaims = record.claims.filter((claim) => claim.inPublicSummary);
  for (const claim of summaryClaims) {
    if (claim.evidence.length === 0) {
      blockers.push(
        blocker(
          'summary_claims_have_evidence',
          'grounded',
          'Public summary prose depends on a claim with no evidence attached.',
          'Attach evidence that entails the assertion, or remove it from the summary.',
          claim.id,
        ),
      );
    }
  }

  // ---- deficit-driven gates ----
  for (const deficit of deficits) {
    const gate = DEFICITS_BLOCKING[deficit.code];
    if (gate === undefined) continue;
    blockers.push(
      blocker(gate, GATE_LEVEL[gate], deficit.explanation, deficit.remediation, deficit.claimId),
    );
  }

  // ---- corroborated: high-impact claims need two lineages that can actually corroborate ----
  for (const claim of record.claims) {
    if (!isHighImpactAssertion(claim.assertionClass)) continue;
    const corroborating = corroboratingLineageKeys(claim.evidence);
    if (corroborating.size < 2) continue;
    // Two lineages is necessary and not sufficient: one must be fit to carry the assertion.
    const anyAuthoritative = claim.evidence.some((item) => {
      const { fitness } = assessSourceFitness(item.sourceClass, claim.assertionClass);
      return fitness === 'authoritative' || fitness === 'strong';
    });
    if (!anyAuthoritative) {
      blockers.push(
        blocker(
          'high_impact_corroborated',
          'corroborated',
          `A ${claim.assertionClass.replace(/_/gu, ' ')} claim has two independent lineages but neither is a source fit to establish it.`,
          'One corroborating lineage must be authoritative or near-primary for this kind of assertion, not merely independent.',
          claim.id,
        ),
      );
    }
  }

  // ---- deep_research ----
  const openNeeds = input.openMandatoryNeeds ?? [];
  if (openNeeds.length > 0) {
    blockers.push(
      blocker(
        'no_open_mandatory_needs',
        'reference',
        `${openNeeds.length} mandatory evidence need(s) remain open: ${openNeeds.join(', ')}.`,
        'Resolve each need, or record it as an explicit blocker with the reason it cannot be met.',
      ),
    );
  }

  // ---- reference ----
  const review = input.independentReview;
  if (review === undefined) {
    blockers.push(
      blocker(
        'independently_reviewed',
        'reference',
        'No independent second review has been recorded.',
        'Have an actor distinct from the one that produced this record review it adversarially.',
      ),
    );
  } else if (review.reviewerActorId === review.producerActorId) {
    blockers.push(
      blocker(
        'independently_reviewed',
        'reference',
        'The recorded reviewer is the actor that produced the record, which is not review.',
        'Route the review to a different actor.',
      ),
    );
  } else if (review.correctionForcingFindings > 0) {
    blockers.push(
      blocker(
        'independently_reviewed',
        'reference',
        `Review left ${review.correctionForcingFindings} correction-forcing finding(s) unresolved.`,
        'Resolve every correction-forcing finding before the record is treated as a reference.',
      ),
    );
  }

  // The record holds the highest state with no blocker at or below it.
  const blockedLevels = new Set(blockers.map((b) => b.blocks));
  let maturity: ResearchMaturity = 'seeded';
  for (const state of ORDER) {
    if (blockedLevels.has(state)) {
      // The first blocked state caps the record one below it.
      const index = ORDER.indexOf(state);
      maturity = index === 0 ? 'seeded' : ORDER[index - 1]!;
      break;
    }
    maturity = state;
  }
  // A record blocked at `seeded` itself is still `seeded`; there is nothing below it. The state
  // means "we have a lead", not "this is researched", which is exactly what such a record is.

  const satisfiedGates = RESEARCH_GATE_IDS.filter((gate) => !blockers.some((b) => b.gate === gate));

  return {
    maturity,
    satisfiedGates,
    blockers,
    evidenceDeficits: deficits,
    priority: enrichmentPriority(deficits, { released: record.released }),
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    evaluatorVersion: RESEARCH_EVALUATOR_VERSION,
  };
}

/** The blockers standing between a record and the next state up. */
export function blockersToNextState(
  assessment: ResearchMaturityAssessment,
): readonly ResearchBlocker[] {
  const index = ORDER.indexOf(assessment.maturity);
  const next = ORDER[index + 1];
  if (next === undefined) return [];
  return assessment.blockers.filter((b) => b.blocks === next);
}

/** The next state up, or undefined at `reference`. */
export function nextMaturityState(current: ResearchMaturity): ResearchMaturity | undefined {
  return ORDER[ORDER.indexOf(current) + 1];
}

/**
 * A one-line operator summary.
 *
 * Deliberately not a number. "CORROBORATED — 2 blockers to Contextualized" is actionable in a
 * way that "84/100" is not.
 */
export function describeMaturity(assessment: ResearchMaturityAssessment): string {
  const next = nextMaturityState(assessment.maturity);
  const toNext = blockersToNextState(assessment);
  const label = assessment.maturity.replace(/_/gu, ' ').toUpperCase();
  if (next === undefined) return `${label} — no further state`;
  if (toNext.length === 0) return `${label} — no blockers recorded to ${next.replace(/_/gu, ' ')}`;
  return `${label} — ${toNext.length} blocker(s) to ${next.replace(/_/gu, ' ')}`;
}
