/**
 * Core entity, alias, and external identifier types (BB-014).
 *
 * BB-090 extends this with a 12th entity kind (`movement`), kind-specific status lifecycle
 * (`statusHistory`), an auditable notability-basis inclusion rubric (`notabilityBasis`), and a
 * sensitivity classification schema (`sensitivity`). See ./entity-status.ts for the added status
 * vocabularies and notability/sensitivity types, ./movement.ts for the movement field bag, and
 * ./era.ts for the shared date-precision/decade model they build on. See ADR-015 for the full
 * ontology decision record.
 */
import type { EntityKind } from './entity-kinds.js';
import type { LivingStatus } from './living.js';
import type { PlaceFields } from './geography/location.js';
import type { SchoolFields } from './school.js';
import type { MovementFields } from './movement.js';
import {
  currentStatus,
  personStatusFromLiving,
  type EntitySensitivity,
  type EntityStatusValue,
  type NotabilityBasisRecord,
  type StatusHistoryEntry,
} from './entity-status.js';
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
 *
 * `statusHistory` is entity-LIFECYCLE status only (active/historic/inactive/in_force/etc, per
 * kind — see ./entity-status.ts). It must NEVER be used to store area/condition designations
 * (sundown-town, redlining grade, exclusion infrastructure) — those remain BB-082's own,
 * separately-typed, time-scoped layer records, never merged into this array. `kind: 'event'`
 * entities never carry statusHistory (their when-span is authoritative); `kind: 'person'`
 * entities never carry it either — person status derives from `livingStatus` via
 * `personStatusFromLiving()` (./entity-status.ts), not from a second field.
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
  /**
   * Time-scoped entity-lifecycle status designations (BB-090). Omitted for `event` and `person`
   * kinds by convention — see the class doc comment above. Current status is always derived via
   * `currentEntityStatus()` / `currentStatus()`, never stored as an independent scalar.
   */
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  /**
   * Auditable inclusion basis (BB-090) — at least one record is required to publish (see
   * `hasRequiredNotabilityBasis()` / `packages/domain/src/relevance/notability-gate.ts`). Never
   * a numeric score: numeric notability scores are banned from public payloads by standing
   * policy.
   */
  readonly notabilityBasis?: readonly NotabilityBasisRecord[];
  /** Schema-only sensitivity classification (BB-090); presentation is BB-095. */
  readonly sensitivity?: readonly EntitySensitivity[];
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
  readonly movement?: MovementFields;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Derives the entity's current status per its kind (BB-090 AC1): person status comes from
 * `livingStatus` (never a second field); `event` carries no status at all; every other kind
 * derives from the open-ended `statusHistory` record (never hand-edited independently).
 */
export function currentEntityStatus(entity: CanonicalEntity): string | undefined {
  if (entity.kind === 'person') {
    return personStatusFromLiving(entity.livingStatus);
  }
  if (entity.kind === 'event') {
    return undefined;
  }
  return currentStatus(entity.statusHistory);
}
