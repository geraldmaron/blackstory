
/**
 * Zod-backed Firestore converters and parse helpers for Black Book documents.
 */
import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase/firestore';
import type { z } from 'zod';
import {
  assertLearningIndexProjection,
  sanitizePrimaryImageForRelease,
} from '@repo/domain';
import { assertPublicProjectionSafe } from '@repo/security';
import {
  auditEventSchema,
  canonicalClaimSchema,
  canonicalEntitySchema,
  claimEvidenceLinkSchema,
  claimVersionSchema,
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
  type ClaimVersionDoc,
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

/**
 * Normalize a projection for public write: drop uncleared primaryImage, enforce
 * learning-index summary gate, then fail-closed structural redaction.
 */
export function preparePublicEntityProjectionForWrite(
  modelObject: PublicEntityProjectionDoc,
): PublicEntityProjectionDoc {
  const parsed = publicEntityProjectionSchema.parse(modelObject);
  const parsedPrimaryImage =
    parsed.primaryImage !== undefined
      ? {
          url: parsed.primaryImage.url,
          alt: parsed.primaryImage.alt,
          credit: parsed.primaryImage.credit,
          rightsStatus: parsed.primaryImage.rightsStatus,
          ...(parsed.primaryImage.width !== undefined ? { width: parsed.primaryImage.width } : {}),
          ...(parsed.primaryImage.height !== undefined ? { height: parsed.primaryImage.height } : {}),
          ...(parsed.primaryImage.objectPath !== undefined
            ? { objectPath: parsed.primaryImage.objectPath }
            : {}),
        }
      : undefined;
  const primaryImage = sanitizePrimaryImageForRelease(parsedPrimaryImage);

  const prepared = {
    ...parsed,
    ...(primaryImage !== undefined ? { primaryImage } : {}),
  } as PublicEntityProjectionDoc;

  if (primaryImage === undefined && 'primaryImage' in prepared) {
    delete (prepared as { primaryImage?: unknown }).primaryImage;
  }

  const normalizedRelated = prepared.related?.map((entry) => ({
    id: entry.id,
    type: entry.type,
    direction: entry.direction,
    ...(entry.timespan !== undefined
      ? {
          timespan: {
            ...(entry.timespan.label !== undefined ? { label: entry.timespan.label } : {}),
            ...(entry.timespan.validFrom !== undefined
              ? { validFrom: entry.timespan.validFrom }
              : {}),
            ...(entry.timespan.validTo !== undefined ? { validTo: entry.timespan.validTo } : {}),
          },
        }
      : {}),
  }));

  assertLearningIndexProjection({
    summary: prepared.summary,
    topicTags: prepared.topicTags,
    ...(prepared.historicalContext !== undefined
      ? { historicalContext: prepared.historicalContext }
      : {}),
    ...(prepared.extendedNarrative !== undefined
      ? { extendedNarrative: prepared.extendedNarrative }
      : {}),
    ...(primaryImage !== undefined ? { primaryImage } : {}),
    ...(normalizedRelated !== undefined ? { related: normalizedRelated } : {}),
  });
  assertPublicProjectionSafe(prepared);
  return prepared;
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
/** Converter for `canonicalClaims/{claimId}/versions/{versionId}` (append-only subcollection). */
export const claimVersionConverter = createConverter(claimVersionSchema);
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
    return preparePublicEntityProjectionForWrite(modelObject) as Record<string, unknown>;
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
  ClaimVersionDoc,
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
