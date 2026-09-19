/**
 * Check a fact's declared derivation against supplied canonical claims. Confidence cannot
 * exceed the weakest backing claim: unpublished or contradictory claims yield contested;
 * otherwise lineage count and the existing authority threshold set a qualitative ceiling.
 * Citation document ids must occur among backing evidence ids. Citations without document ids
 * cannot be checked by this method. Empty derivedFromClaimIds skips comparison; declared but
 * unresolved ids fail closed. This is a consistency rule, not calibrated probability or
 * independent entailment review.
 */
import { isClaimPublished, type CanonicalClaim } from '../claims/claim.js';
import type { ConfidenceScore } from '../claims/confidence.js';
import { FACT_CONFIDENCE_GRADES, type FactConfidenceGrade } from './confidence.js';
import type { FactCitation } from './citation.js';

/** The subset of a `CanonicalClaim` this check actually needs. */
export type FactDerivationBackingClaim = Pick<
  CanonicalClaim,
  'id' | 'workflowStatus' | 'publicationStatus'
> & {
  readonly confidence?: ConfidenceScore;
};

export type FactDerivationCheckFailureReason =
  | 'unresolved_claim_id'
  | 'confidence_exceeds_backing_claims'
  | 'citation_untraceable_to_backing_evidence';

export type FactDerivationCheckResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: FactDerivationCheckFailureReason;
      readonly message: string;
    };

export type FactDerivationCheckInput = {
  readonly fact: {
    readonly id?: string;
    readonly citations: readonly FactCitation[];
    readonly confidence: FactConfidenceGrade;
    readonly derivedFromClaimIds: readonly string[];
  };
  readonly backingClaims: readonly FactDerivationBackingClaim[];
};

/** Ordinal strength rank of a `FactConfidenceGrade`  LOWER rank is stronger. Reuses
 * `FACT_CONFIDENCE_GRADES`' own declared order (already strongest-to-weakest) rather than
 * inventing a second ranking. */
const GRADE_RANK: Readonly<Record<FactConfidenceGrade, number>> = Object.fromEntries(
  FACT_CONFIDENCE_GRADES.map((grade, index) => [grade, index]),
) as Record<FactConfidenceGrade, number>;

/** Same "reputable secondary or better" bar the claim confidence engine uses for
 * `CLASSIFICATION_AUTHORITY.reputable_secondary` (`../claims/confidence.ts`)  reused here so the
 * "established" ceiling is grounded in an existing policy number, not a new one. */
const ESTABLISHED_SOURCE_AUTHORITY_FLOOR = 0.75;
const ESTABLISHED_LINEAGE_FLOOR = 2;
const CORROBORATED_LINEAGE_FLOOR = 2;
const SINGLE_SOURCE_LINEAGE = 1;

/**
 * See the module doc for the full rule. Intentionally conservative: it only ever returns a
 * grade the claim's own recorded signals can justify, never guesses upward.
 */
export function maxFactConfidenceGradeForClaim(
  claim: FactDerivationBackingClaim,
): FactConfidenceGrade {
  if (!isClaimPublished(claim)) return 'contested';

  const confidence = claim.confidence;
  if (!confidence) return 'contested'; // no measured evidence behind the claim to vouch with

  if (confidence.contradictingEvidenceCount > 0) return 'contested';

  if (confidence.independentLineageCount >= ESTABLISHED_LINEAGE_FLOOR) {
    return confidence.components.sourceAuthority >= ESTABLISHED_SOURCE_AUTHORITY_FLOOR
      ? 'established'
      : 'corroborated';
  }
  if (confidence.independentLineageCount >= CORROBORATED_LINEAGE_FLOOR) return 'corroborated';
  if (confidence.independentLineageCount === SINGLE_SOURCE_LINEAGE) return 'single-source';
  return 'contested';
}

/**
 * Cross-checks one `FactRecord`'s citations/confidence against the `CanonicalClaim`(s) named in
 * its `derivedFromClaimIds`. Callers must supply every backing claim named there in
 * `backingClaims`  see the module doc for why a missing claim fails closed rather than being
 * skipped.
 */
export function evaluateFactDerivationConsistency(
  input: FactDerivationCheckInput,
): FactDerivationCheckResult {
  const { fact, backingClaims } = input;
  const factLabel = fact.id ?? '(unspecified fact id)';

  if (fact.derivedFromClaimIds.length === 0) {
    // No declared derivation: nothing to cross-check (see ./record.ts's field doc and the
    // backfill decision in this module's doc comment).
    return { ok: true };
  }

  const byId = new Map(backingClaims.map((claim) => [claim.id, claim] as const));
  const missing = fact.derivedFromClaimIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: 'unresolved_claim_id',
      message:
        `Fact ${factLabel} declares derivedFromClaimIds [${missing.join(', ')}] that were not ` +
        'supplied to the derivation check. A fact cannot be verified consistent with claims the ' +
        'caller has not loaded  supply every backing claim named in derivedFromClaimIds.',
    };
  }

  const backing = fact.derivedFromClaimIds.map((id) => byId.get(id)!);

  // --- confidence ceiling: the fact cannot be stronger than its WEAKEST backing claim ---
  const ceilingRank = Math.max(
    ...backing.map((claim) => GRADE_RANK[maxFactConfidenceGradeForClaim(claim)]),
  );
  const factRank = GRADE_RANK[fact.confidence];
  if (factRank < ceilingRank) {
    const ceilingGrade = FACT_CONFIDENCE_GRADES.find((grade) => GRADE_RANK[grade] === ceilingRank)!;
    return {
      ok: false,
      reason: 'confidence_exceeds_backing_claims',
      message:
        `Fact ${factLabel} claims confidence "${fact.confidence}" but its backing claim(s) ` +
        `(${fact.derivedFromClaimIds.join(', ')}) only support up to "${ceilingGrade}". A fact ` +
        'cannot assert stronger confidence than its canonical claims actually have.',
    };
  }

  // --- citation traceability (soft subset check via documentId, see module doc) ---
  const contributingIds = new Set(
    backing.flatMap((claim) => claim.confidence?.contributingEvidenceIds ?? []),
  );
  const untraceable = fact.citations.filter(
    (citation) => citation.documentId !== undefined && !contributingIds.has(citation.documentId),
  );
  if (untraceable.length > 0) {
    return {
      ok: false,
      reason: 'citation_untraceable_to_backing_evidence',
      message:
        `Fact ${factLabel} has ${untraceable.length} citation(s) whose documentId does not appear ` +
        'among the contributingEvidenceIds of any declared backing claim ' +
        `(${fact.derivedFromClaimIds.join(', ')}). A citation identifiable against claim evidence ` +
        'must trace back to evidence the claim actually used.',
    };
  }

  return { ok: true };
}

export function assertFactDerivationConsistent(input: FactDerivationCheckInput): void {
  const result = evaluateFactDerivationConsistency(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
