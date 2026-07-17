/**
 * Auditable entity-resolution contracts for discovery candidates and canonical entities.
 */
import type { CanonicalEntity } from '../entity.js';
import type { EntityKind } from '../entity-kinds.js';
import type { EntityLocation, Jurisdiction } from '../geography/location.js';

export type ParsedAddress = {
  readonly raw: string;
  readonly street?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly countryCode: string;
};

export type ResolutionCandidate = {
  readonly id: string;
  readonly name: string;
  readonly kind?: EntityKind;
  readonly aliases?: readonly string[];
  readonly address?: string;
  readonly year?: number;
  readonly geographicHints?: readonly string[];
  readonly identifiers?: Readonly<Record<string, string>>;
  readonly sourceReferenceIds: readonly string[];
};

export type ResolutionProfile = {
  readonly entity: CanonicalEntity;
  readonly locations?: readonly EntityLocation[];
};

export type ResolutionContext = {
  readonly jurisdictions?: readonly Jurisdiction[];
};

export type MatchFactor = {
  readonly factor: 'name' | 'kind' | 'identifier' | 'geography' | 'temporal';
  readonly score: number;
  readonly rationale: string;
};

export type RankedEntityMatch = {
  readonly entityId: string;
  readonly confidence: number;
  readonly factors: readonly MatchFactor[];
};

export type ResolutionOutcome = 'proposed_match' | 'review_required' | 'no_match';

export type ResolutionResult = {
  readonly candidateId: string;
  readonly outcome: ResolutionOutcome;
  readonly selectedEntityId?: string;
  readonly rankedMatches: readonly RankedEntityMatch[];
  readonly rationale: readonly string[];
};

export type DuplicateReviewQueueItem = {
  readonly id: string;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly status: 'pending';
  readonly reason: 'ambiguous_match' | 'low_confidence_match';
  readonly proposedEntityIds: readonly string[];
  readonly rankedMatches: readonly RankedEntityMatch[];
  readonly sourceReferenceIds: readonly string[];
  readonly createdAt: string;
};

export type ResolutionDecision = {
  readonly id: string;
  readonly candidateId: string;
  readonly selectedEntityId: string | null;
  readonly status: 'proposed' | 'applied' | 'reversed';
  readonly confidence: number;
  readonly rationale: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly sourceReferenceIds: readonly string[];
  readonly appliedAt?: string;
  readonly reversedAt?: string;
  readonly reversedBy?: string;
  readonly reverseReason?: string;
};
