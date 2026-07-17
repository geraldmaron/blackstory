
/**
 * Zod-backed Firestore converters and parse helpers for Black Book documents.
 */
import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase/firestore';
import type { z } from 'zod';
import { assertPublicProjectionSafe } from '@black-book/security';
import {
  auditEventSchema,
  canonicalClaimSchema,
  canonicalEntitySchema,
  claimEvidenceLinkSchema,
  entityLocationSchema,
  entityMergeSchema,
  entityRelationshipSchema,
  evidenceLineageSchema,
  evidenceRecordSchema,
  evidenceSourceSchema,
  idempotencyRecordSchema,
  killSwitchSchema,
  outboxConsumerReceiptSchema,
  outboxMessageSchema,
  policyActiveSchema,
  policyVersionSchema,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  publicationReleaseSchema,
  retrievalEventSchema,
  sourceCaptureSchema,
  sourceDomainSchema,
  sourceItemSchema,
  sourceOrganizationSchema,
  submissionInboxSchema,
  type AuditEventDoc,
  type CanonicalClaimDoc,
  type CanonicalEntityDoc,
  type ClaimEvidenceLinkDoc,
  type EntityLocationDoc,
  type EntityMergeDoc,
  type EntityRelationshipDoc,
  type EvidenceLineageDoc,
  type EvidenceRecordDoc,
  type EvidenceSourceDoc,
  type IdempotencyRecordDoc,
  type KillSwitchDoc,
  type OutboxConsumerReceiptDoc,
  type OutboxMessageDoc,
  type PolicyActiveDoc,
  type PolicyVersionDoc,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
  type PublicationReleaseDoc,
  type RetrievalEventDoc,
  type SourceCaptureDoc,
  type SourceDomainDoc,
  type SourceItemDoc,
  type SourceOrganizationDoc,
  type SubmissionInboxDoc,
} from './types.js';

function createConverter<T>(schema: z.ZodType<T>): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: T) {
      return schema.parse(modelObject) as Record<string, unknown>;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return schema.parse(snapshot.data());
    },
  };
}

export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

export const policyActiveConverter = createConverter(policyActiveSchema);
export const policyVersionConverter = createConverter(policyVersionSchema);
export const canonicalEntityConverter = createConverter(canonicalEntitySchema);
export const entityLocationConverter = createConverter(entityLocationSchema);
export const entityRelationshipConverter = createConverter(entityRelationshipSchema);
export const entityMergeConverter = createConverter(entityMergeSchema);
export const canonicalClaimConverter = createConverter(canonicalClaimSchema);
export const claimEvidenceLinkConverter = createConverter(claimEvidenceLinkSchema);
export const sourceOrganizationConverter = createConverter(sourceOrganizationSchema);
export const sourceDomainConverter = createConverter(sourceDomainSchema);
export const evidenceSourceConverter = createConverter(evidenceSourceSchema);
export const sourceItemConverter = createConverter(sourceItemSchema);
export const sourceCaptureConverter = createConverter(sourceCaptureSchema);
export const retrievalEventConverter = createConverter(retrievalEventSchema);
export const evidenceRecordConverter = createConverter(evidenceRecordSchema);
export const evidenceLineageConverter = createConverter(evidenceLineageSchema);
export const publicationReleaseConverter = createConverter(publicationReleaseSchema);
export const publicActiveReleaseConverter = createConverter(publicActiveReleaseSchema);
export const publicEntityProjectionConverter: FirestoreDataConverter<PublicEntityProjectionDoc> = {
  toFirestore(modelObject: PublicEntityProjectionDoc) {
    const parsed = publicEntityProjectionSchema.parse(modelObject);
    assertPublicProjectionSafe(parsed);
    return parsed as Record<string, unknown>;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): PublicEntityProjectionDoc {
    return publicEntityProjectionSchema.parse(snapshot.data());
  },
};
export const submissionInboxConverter = createConverter(submissionInboxSchema);
export const auditEventConverter = createConverter(auditEventSchema);
export const outboxMessageConverter = createConverter(outboxMessageSchema);
export const idempotencyRecordConverter = createConverter(idempotencyRecordSchema);
export const outboxConsumerReceiptConverter = createConverter(outboxConsumerReceiptSchema);
export const killSwitchConverter = createConverter(killSwitchSchema);

export type {
  AuditEventDoc,
  CanonicalClaimDoc,
  CanonicalEntityDoc,
  ClaimEvidenceLinkDoc,
  EntityLocationDoc,
  EntityMergeDoc,
  EntityRelationshipDoc,
  EvidenceLineageDoc,
  EvidenceRecordDoc,
  EvidenceSourceDoc,
  IdempotencyRecordDoc,
  KillSwitchDoc,
  OutboxConsumerReceiptDoc,
  OutboxMessageDoc,
  PolicyActiveDoc,
  PolicyVersionDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  PublicationReleaseDoc,
  RetrievalEventDoc,
  SourceCaptureDoc,
  SourceDomainDoc,
  SourceItemDoc,
  SourceOrganizationDoc,
  SubmissionInboxDoc,
};
