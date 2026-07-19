/**
 * Atomic claims, versions, temporal/geographic context, and procedural status.
 */
import type { ClaimClass } from '@repo/schemas';
import { isRecognizedVocabulary, loadProductConstitution } from '@repo/schemas';
import type { GeographicRelationshipContext, TemporalContext } from '../relationship.js';
import type { ConfidenceScore } from './confidence.js';
import type {
  ConnectionStrengthMeasurement,
  RelevanceMeasurement,
  ResearchCoverage,
} from './measurements.js';

export const CLAIM_WORKFLOW_STATUSES = [
  'proposed',
  'accepted',
  'rejected',
  'superseded',
] as const;
export type ClaimWorkflowStatus = (typeof CLAIM_WORKFLOW_STATUSES)[number];

export const CLAIM_PUBLICATION_STATUSES = ['unpublished', 'published', 'retracted'] as const;
export type ClaimPublicationStatus = (typeof CLAIM_PUBLICATION_STATUSES)[number];

export type ClaimGeographicContext = GeographicRelationshipContext & {
  readonly precision?: string;
};

/** One independently supportable assertion at a point in version history. */
export type ClaimVersion = {
  readonly id: string;
  readonly claimId: string;
  readonly versionNumber: number;
  /** Subject entity the claim is about. */
  readonly entityId: string;
  /** Atomic predicate (one independently supportable assertion). */
  readonly predicate: string;
  /** Primary asserted value object for this version. */
  readonly object: string;
  readonly temporal?: TemporalContext;
  readonly geographic?: ClaimGeographicContext;
  /** Legal procedural vocabulary token from the constitution. */
  readonly proceduralStatus: string;
  readonly claimClass: ClaimClass;
  readonly workflowStatus: ClaimWorkflowStatus;
  readonly publicationStatus: ClaimPublicationStatus;
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly supersedesVersionId?: string;
  readonly notes?: string;
};

/**
 * Canonical atomic claim: identity + current version pointer + measurements.
 *
 * Prior versions no longer live in an embedded array on this parent doc — each
 * version is its own immutable document in the Firestore
 * `canonicalClaims/{claimId}/versions/{versionId}` subcollection (append-only:
 * creates allowed, updates/deletes denied). Load a specific version (or the
 * current one, via `currentVersionId`) from that subcollection rather than
 * expecting it embedded here. See `findCurrentClaimVersion`.
 */
export type CanonicalClaim = {
  readonly id: string;
  readonly entityId: string;
  readonly predicate: string;
  readonly currentVersionId: string;
  readonly claimClass: ClaimClass;
  readonly workflowStatus: ClaimWorkflowStatus;
  readonly publicationStatus: ClaimPublicationStatus;
  readonly proceduralStatus: string;
  readonly temporal?: TemporalContext;
  readonly geographic?: ClaimGeographicContext;
  readonly confidence?: ConfidenceScore;
  readonly relevance?: RelevanceMeasurement;
  readonly connectionStrength?: ConnectionStrengthMeasurement;
  readonly researchCoverage?: ResearchCoverage;
  /**
   * Credible alternate contradicting values preserved alongside the primary object
   * (never silently collapsed).
   */
  readonly preservedValues: readonly PreservedClaimValue[];
  /** ISO timestamp of the last independent verification pass over this claim, if any. */
  readonly lastVerifiedAt?: string;
  /** Version id that was current as of the last verification pass, if any. */
  readonly lastVerifiedVersionId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PreservedClaimValue = {
  readonly value: string;
  readonly evidenceLinkIds: readonly string[];
  readonly credible: boolean;
  readonly kind: 'primary' | 'contradicting' | 'alternative';
};

export function isClaimWorkflowStatus(value: string): value is ClaimWorkflowStatus {
  return (CLAIM_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

export function isClaimPublicationStatus(value: string): value is ClaimPublicationStatus {
  return (CLAIM_PUBLICATION_STATUSES as readonly string[]).includes(value);
}

export function assertProceduralStatusRecognized(proceduralStatus: string): void {
  const result = isRecognizedVocabulary('legalStatus', proceduralStatus);
  if (!result.recognized) {
    throw new Error(`Unrecognized procedural status: ${proceduralStatus}`);
  }
}

export function assertClaimVersionValid(version: ClaimVersion): void {
  if (!version.id.trim()) throw new Error('Claim version id is required');
  if (!version.claimId.trim()) throw new Error('Claim version claimId is required');
  if (!version.entityId.trim()) throw new Error('Claim version entityId is required');
  if (!version.predicate.trim()) throw new Error('Claim predicate must be non-empty');
  if (!version.object.trim()) throw new Error('Claim object must be non-empty');
  if (version.versionNumber < 1) throw new Error('versionNumber must be >= 1');
  if (!isClaimWorkflowStatus(version.workflowStatus)) {
    throw new Error(`Unknown claim workflow status: ${version.workflowStatus}`);
  }
  if (!isClaimPublicationStatus(version.publicationStatus)) {
    throw new Error(`Unknown claim publication status: ${version.publicationStatus}`);
  }
  assertProceduralStatusRecognized(version.proceduralStatus);
}

/** Validates the parent claim doc alone (versions now live in their own subcollection). */
export function assertCanonicalClaimValid(claim: CanonicalClaim): void {
  if (!claim.id.trim()) throw new Error('Claim id is required');
  if (!claim.entityId.trim()) throw new Error('Claim entityId is required');
  if (!claim.predicate.trim()) throw new Error('Claim predicate must be non-empty');
  if (!claim.currentVersionId.trim()) throw new Error('Claim currentVersionId is required');
  if (!isClaimWorkflowStatus(claim.workflowStatus)) {
    throw new Error(`Unknown claim workflow status: ${claim.workflowStatus}`);
  }
  if (!isClaimPublicationStatus(claim.publicationStatus)) {
    throw new Error(`Unknown claim publication status: ${claim.publicationStatus}`);
  }
  assertProceduralStatusRecognized(claim.proceduralStatus);
}

/**
 * Cross-checks a parent claim doc against its current version, once both have been
 * loaded (the version from the `versions` subcollection). Callers that already have
 * both docs in hand (e.g. after a version write) should call this in addition to
 * `assertCanonicalClaimValid` and `assertClaimVersionValid`.
 */
export function assertCanonicalClaimMatchesCurrentVersion(
  claim: Pick<
    CanonicalClaim,
    'id' | 'currentVersionId' | 'workflowStatus' | 'publicationStatus' | 'proceduralStatus' | 'claimClass'
  >,
  currentVersion: ClaimVersion,
): void {
  if (currentVersion.id !== claim.currentVersionId) {
    throw new Error('currentVersionId must reference the provided current version');
  }
  if (currentVersion.claimId !== claim.id) {
    throw new Error('Claim version claimId must match parent claim id');
  }
  if (claim.workflowStatus !== currentVersion.workflowStatus) {
    throw new Error('Claim workflowStatus must match current version');
  }
  if (claim.publicationStatus !== currentVersion.publicationStatus) {
    throw new Error('Claim publicationStatus must match current version');
  }
  if (claim.proceduralStatus !== currentVersion.proceduralStatus) {
    throw new Error('Claim proceduralStatus must match current version');
  }
  if (claim.claimClass !== currentVersion.claimClass) {
    throw new Error('Claim claimClass must match current version');
  }
}

/** True when a claim is published and accepted (eligible for public narrative citation). */
export function isClaimPublished(claim: Pick<CanonicalClaim, 'workflowStatus' | 'publicationStatus'>): boolean {
  return claim.workflowStatus === 'accepted' && claim.publicationStatus === 'published';
}

/**
 * Finds the current version within an already-loaded list of version docs
 * (e.g. fetched from the `versions` subcollection). Versions are no longer
 * embedded on the parent, so callers must supply them explicitly.
 */
export function findCurrentClaimVersion(
  claim: Pick<CanonicalClaim, 'currentVersionId'>,
  versions: readonly ClaimVersion[],
): ClaimVersion {
  const version = versions.find((v) => v.id === claim.currentVersionId);
  if (!version) {
    throw new Error('currentVersionId must reference a version on the claim');
  }
  return version;
}

export function claimClassThreshold(
  claimClass: ClaimClass,
  policy = loadProductConstitution(),
): number {
  if (claimClass === 'high_impact' && policy.publicationRestrictions.highImpactRequiresHigherThreshold) {
    return policy.claimConfidenceThresholds.highImpactPublish;
  }
  return policy.claimConfidenceThresholds.standardPublish;
}
