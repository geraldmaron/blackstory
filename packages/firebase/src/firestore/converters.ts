/**
 * Zod-backed Firestore converters and parse helpers for Black Book documents.
 */
import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase/firestore';
import type { z } from 'zod';
import {
  auditEventSchema,
  canonicalEntitySchema,
  entityLocationSchema,
  entityMergeSchema,
  entityRelationshipSchema,
  evidenceRecordSchema,
  killSwitchSchema,
  policyActiveSchema,
  policyVersionSchema,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  publicationReleaseSchema,
  submissionInboxSchema,
  type AuditEventDoc,
  type CanonicalEntityDoc,
  type EntityLocationDoc,
  type EntityMergeDoc,
  type EntityRelationshipDoc,
  type EvidenceRecordDoc,
  type KillSwitchDoc,
  type PolicyActiveDoc,
  type PolicyVersionDoc,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
  type PublicationReleaseDoc,
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
export const evidenceRecordConverter = createConverter(evidenceRecordSchema);
export const publicationReleaseConverter = createConverter(publicationReleaseSchema);
export const publicActiveReleaseConverter = createConverter(publicActiveReleaseSchema);
export const publicEntityProjectionConverter = createConverter(publicEntityProjectionSchema);
export const submissionInboxConverter = createConverter(submissionInboxSchema);
export const auditEventConverter = createConverter(auditEventSchema);
export const killSwitchConverter = createConverter(killSwitchSchema);

export type {
  AuditEventDoc,
  CanonicalEntityDoc,
  EntityLocationDoc,
  EntityMergeDoc,
  EntityRelationshipDoc,
  EvidenceRecordDoc,
  KillSwitchDoc,
  PolicyActiveDoc,
  PolicyVersionDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  PublicationReleaseDoc,
  SubmissionInboxDoc,
};
