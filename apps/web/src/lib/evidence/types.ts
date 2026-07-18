/**
 * View-model types for the evidence, confidence, dispute, and revision interface.
 *
 * These types intentionally sit one layer above `apps/web/src/data/public-seed.ts`'s
 * `PublicClaimView` (a seed-depth placeholder ahead of public projections): every
 * field already on `PublicClaimView` (id, predicate, object, confidenceScore, confidenceLevel,
 * citationSource/citationHref/citationLabel, disputed/disputeNote) has a structurally-compatible
 * counterpart here, so a caller can pass seed claims through with light field renaming and get a
 * working panel today, while the richer optional fields (source lineage, excerpts, research
 * coverage, revision history, retraction notices) are ready to receive real data
 * once projections land, without a breaking shape change.
 *
 * Reuses domain vocabulary directly (`RightsStatus`, `ExcerptKind`,
 * `PublicationPermission`, `ProhibitedUse`, `ContradictionSet`-compatible alternate-value kinds)
 * rather than re-declaring a parallel vocabulary.
 */
import type { ConfidenceLevel } from '@blap/ui';
import type { ExcerptKind, ProhibitedUse, PublicationPermission, RightsStatus } from '@blap/domain';

export const EVIDENCE_RESEARCH_COVERAGE_LEVELS = [
  'none',
  'minimal',
  'partial',
  'substantial',
  'comprehensive',
] as const;

export type EvidenceResearchCoverageLevel = (typeof EVIDENCE_RESEARCH_COVERAGE_LEVELS)[number];

export type EvidenceResearchCoverageInput = {
  readonly level: EvidenceResearchCoverageLevel;
  readonly notes?: string;
  readonly lastCheckedAt?: string;
};

/** Independent-lineage rollup.  */
export type EvidenceSourceLineageInput = {
  readonly independentLineageCount: number;
  readonly supportingEvidenceCount?: number;
  readonly contradictingEvidenceCount?: number;
};

export type EvidenceExcerptInput = {
  readonly text: string;
  readonly excerptKind: ExcerptKind;
  readonly rightsStatus: RightsStatus;
  readonly publicationPermissions?: readonly PublicationPermission[];
  readonly prohibitedUses?: readonly ProhibitedUse[];
};

export type EvidenceExcerptView =
  | { readonly visible: true; readonly text: string; readonly excerptKind: ExcerptKind }
  | { readonly visible: false; readonly reason: string };

export type EvidenceCitationInput = {
  readonly source: string;
  readonly label: string;
  readonly href?: string;
  /**
   * True when this citation resolves to evidence containing private or otherwise protected
   * material (e.g. an internal-only capture, a living-person-sensitive record). The outbound
   * link and any excerpt must never render publicly, even when a URL exists internally
   * (source links do not leak private evidence or protected information).
   */
  readonly protectedFromPublicLink?: boolean;
  readonly protectedReason?: string;
};

export type EvidenceCitationView = {
  readonly source: string;
  readonly label: string;
  readonly href?: string;
  readonly withheldReason?: string;
};

export type EvidenceAlternateValueKind = 'contradicting' | 'alternative';

export type EvidenceAlternateValue = {
  readonly value: string;
  readonly credible: boolean;
  readonly kind: EvidenceAlternateValueKind;
};

/** Seed-depth-compatible dispute input: `disputed`/`disputeNote` mirror `PublicClaimView` exactly;
 * `alternates` is the additive slot for full `ContradictionSet` values once available. */
export type EvidenceDisputeInput = {
  readonly primaryValue: string;
  readonly disputed?: boolean;
  readonly disputeNote?: string;
  readonly alternates?: readonly EvidenceAlternateValue[];
};

export type EvidenceDisputeView = {
  readonly hasDispute: boolean;
  readonly primaryValue: string;
  readonly note?: string;
  readonly alternates: readonly EvidenceAlternateValue[];
};

export const EVIDENCE_REVISION_CHANGE_KINDS = ['created', 'revised', 'corrected', 'retracted'] as const;
export type EvidenceRevisionChangeKind = (typeof EVIDENCE_REVISION_CHANGE_KINDS)[number];

export type EvidenceRevisionEntry = {
  readonly id: string;
  readonly changedAt: string;
  readonly changeKind: EvidenceRevisionChangeKind;
  readonly summary: string;
  readonly policyVersion?: string;
};

export type EvidenceRetractionNotice = {
  readonly retractedAt: string;
  readonly reason: string;
  readonly supersededByClaimId?: string;
};

export type EvidenceClaimInput = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceScore: number;
  readonly confidenceLevel: ConfidenceLevel;
  readonly citation: EvidenceCitationInput;
  readonly dispute?: EvidenceDisputeInput;
  readonly excerpt?: EvidenceExcerptInput;
  readonly sourceLineage?: EvidenceSourceLineageInput;
  readonly researchCoverage?: EvidenceResearchCoverageInput;
  readonly lastCheckedAt?: string;
  readonly revisionHistory?: readonly EvidenceRevisionEntry[];
  readonly retraction?: EvidenceRetractionNotice;
  /** Free-text rationale for this claim's relevance, kept visibly distinct from confidence —
   * never blended into the confidence score or label. */
  readonly relevanceNote?: string;
  /** Free-text rationale for this claim's connection strength, kept visibly distinct from
   * confidence — never blended into the confidence score or label. */
  readonly connectionStrengthNote?: string;
};

export type EvidenceClaimView = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLabel: string;
  readonly confidenceLevel: ConfidenceLevel;
  readonly confidenceScore: number;
  readonly citation: EvidenceCitationView;
  readonly excerpt?: EvidenceExcerptView;
  readonly dispute?: EvidenceDisputeView;
  readonly sourceLineage?: EvidenceSourceLineageInput;
  readonly researchCoverage?: EvidenceResearchCoverageInput;
  readonly lastCheckedAt?: string;
  readonly revisionHistory: readonly EvidenceRevisionEntry[];
  readonly retraction?: EvidenceRetractionNotice;
  readonly relevanceNote?: string;
  readonly connectionStrengthNote?: string;
};
