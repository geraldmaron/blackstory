/**
 * Core entity, alias, and external identifier types (BB-014).
 */
import type { EntityKind } from './entity-kinds.js';
import type { LivingStatus } from './living.js';
import type { PlaceFields } from './geography/location.js';
import type { SchoolFields } from './school.js';
import type {
  ArtifactFields,
  CaseFields,
  EventFields,
  InstitutionFields,
  LawFields,
  OrganizationFields,
  PersonFields,
  PublicationFields,
} from './specialized.js';

export type EntityAlias = {
  readonly value: string;
  readonly kind?: 'former_name' | 'aka' | 'spelling' | 'translated' | 'other';
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly primary?: boolean;
};

export type EntityIdentifier = {
  readonly system: string;
  readonly value: string;
  readonly note?: string;
};

export type EntityMergeState = {
  readonly status: 'active' | 'merged_away' | 'superseded';
  /** Survivor entity when this record was absorbed. */
  readonly survivorId?: string;
  /** Merge audit document ids (entityMerges collection). */
  readonly mergeIds: readonly string[];
};

/**
 * Canonical historical entity. Kind-specific payloads are optional bags on the same document.
 * Locations and relationships are typically separate Firestore docs/subcollections.
 */
export type CanonicalEntity = {
  readonly id: string;
  readonly kind: EntityKind;
  readonly displayName: string;
  readonly aliases?: readonly EntityAlias[];
  readonly identifiers?: readonly EntityIdentifier[];
  /** Required for person; optional elsewhere. Default unknown ⇒ treat as living. */
  readonly livingStatus?: LivingStatus;
  readonly mergeState?: EntityMergeState;
  readonly person?: PersonFields;
  readonly place?: PlaceFields;
  readonly school?: SchoolFields;
  readonly organization?: OrganizationFields;
  readonly institution?: InstitutionFields;
  readonly event?: EventFields;
  readonly law?: LawFields;
  readonly case?: CaseFields;
  readonly publication?: PublicationFields;
  readonly artifact?: ArtifactFields;
  readonly createdAt: string;
  readonly updatedAt: string;
};
