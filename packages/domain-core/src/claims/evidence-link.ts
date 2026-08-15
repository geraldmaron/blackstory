/**
 * Claim-to-evidence relationships with supporting, contradicting, and contextual roles.
 */
import { assertUnitInterval } from './measurements.js';

export const CLAIM_EVIDENCE_ROLES = ['supporting', 'contradicting', 'contextual'] as const;
export type ClaimEvidenceRole = (typeof CLAIM_EVIDENCE_ROLES)[number];

export type ClaimEvidenceLink = {
  readonly id: string;
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly evidenceId: string;
  readonly role: ClaimEvidenceRole;
  /**
   * Lineage root for syndication counting. Prefer evidence.lineageRootId from;
   * required here so confidence can dedupe without a join.
   */
  readonly lineageRootId: string;
  /** Whether this link is treated as credible for confidence contradiction preservation. */
  readonly credible: boolean;
  readonly sourceClassification: string;
  /** Directness of the evidence to the assertion (0–1). */
  readonly directness: number;
  readonly temporalProximity: number;
  readonly geographicPrecision: number;
  readonly entityMatchQuality: number;
  readonly extractionQuality: number;
  /** Optional asserted value this evidence supports or contradicts. */
  readonly assertedValue?: string;
  readonly notes?: string;
  readonly createdAt: string;
};

export function isClaimEvidenceRole(value: string): value is ClaimEvidenceRole {
  return (CLAIM_EVIDENCE_ROLES as readonly string[]).includes(value);
}

export function assertClaimEvidenceLinkValid(
  link: Pick<
    ClaimEvidenceLink,
    | 'claimId'
    | 'claimVersionId'
    | 'evidenceId'
    | 'role'
    | 'lineageRootId'
    | 'directness'
    | 'temporalProximity'
    | 'geographicPrecision'
    | 'entityMatchQuality'
    | 'extractionQuality'
  >,
): void {
  if (!link.claimId.trim()) throw new Error('claimId is required');
  if (!link.claimVersionId.trim()) throw new Error('claimVersionId is required');
  if (!link.evidenceId.trim()) throw new Error('evidenceId is required');
  if (!link.lineageRootId.trim()) throw new Error('lineageRootId is required');
  if (!isClaimEvidenceRole(link.role)) {
    throw new Error(`Unknown claim evidence role: ${link.role}`);
  }
  assertUnitInterval(link.directness, 'directness');
  assertUnitInterval(link.temporalProximity, 'temporalProximity');
  assertUnitInterval(link.geographicPrecision, 'geographicPrecision');
  assertUnitInterval(link.entityMatchQuality, 'entityMatchQuality');
  assertUnitInterval(link.extractionQuality, 'extractionQuality');
}

export function linksForRole(
  links: readonly ClaimEvidenceLink[],
  role: ClaimEvidenceRole,
): ClaimEvidenceLink[] {
  return links.filter((link) => link.role === role);
}
