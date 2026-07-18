/**
 * Core entity, alias, and external identifier types.
 *
 * Includes a 12th entity kind (`movement`), kind-specific status lifecycle (`statusHistory`),
 * an auditable notability-basis inclusion rubric (`notabilityBasis`), and a sensitivity
 * classification schema (`sensitivity`). See `./entity-status.ts` for the added status
 * vocabularies and notability/sensitivity types, `./movement.ts` for the movement field bag,
 * and `./era.ts` for the shared date-precision/decade model they build on. See ADR-015 for the
 * full ontology decision record.
 */
import type { EntityKind } from './entity-kinds.js';
import type { EntityClass } from './entity-class.js';
import { deriveLivingStatus } from './living.js';
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
 * kind — see `./entity-status.ts`). It must NEVER be used to store area/condition designations
 * (sundown-town, redlining grade, exclusion infrastructure) — those remain separately-typed,
 * time-scoped layer records, never merged into this array. `kind: 'event'` entities never carry
 * statusHistory (their when-span is authoritative); `kind: 'person'` entities never carry it
 * either — person status derives from `livingStatus` via `personStatusFromLiving`
 * (`./entity-status.ts`), not from a second field.
 */
export type CanonicalEntity = {
  readonly id: string;
  readonly kind: EntityKind;
  /**
   * Coarse entity classification (black-book-9mox, `./entity-class.ts`). NEW, additive, and
   * optional — `kind` remains the canonical field every existing consumer reads; these two are
   * derived via `deriveEntityClassification` and not wired into any publish/search/filter
   * pipeline in this pass.
   */
  readonly entityClass?: EntityClass;
  /** Controlled finer-grained subtype label(s) within `entityClass` (e.g. `['church']`). */
  readonly entityTypes?: readonly string[];
  readonly displayName: string;
  readonly aliases?: readonly EntityAlias[];
  readonly identifiers?: readonly EntityIdentifier[];
  /** Required for person; optional elsewhere. Default unknown ⇒ treat as living. */
  readonly livingStatus?: LivingStatus;
  /**
   * Computed/output-only signal from `deriveLivingStatus` (`./living.ts`), black-book-mpfb.
   * NEVER hand-set independently — it exists so callers can store a derivation result without
   * a second independently-settable source of truth. Not wired into `currentEntityStatus` or any
   * publish pipeline in this pass (that overlaps live-release work owned elsewhere); see
   * `deriveEntityLivingStatus` below for how to compute it from this entity's person signals.
   */
  readonly livingStatusDerived?: LivingStatus;
  readonly mergeState?: EntityMergeState;
  /**
   * Time-scoped entity-lifecycle status designations. Omitted for `event` and `person`
   * kinds by convention see the class doc comment above. Current status is always derived via
   * `currentEntityStatus` `currentStatus`, never stored as an independent scalar.
   */
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  /**
   * Auditable inclusion basis at least one record is required to publish (see
   * `hasRequiredNotabilityBasis` `packages/domain/src/relevance/notability-gate.ts`). Never
   * a numeric score: numeric notability scores are banned from public payloads by standing
   * policy.
   */
  readonly notabilityBasis?: readonly NotabilityBasisRecord[];
  /** Schema-only sensitivity classification; presentation lives elsewhere. */
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
 * Derives the entity's current status per its kind: person status comes from
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

/**
 * Computes `livingStatusDerived` (black-book-mpfb) for a person entity from the closest existing
 * signal in this model — `PersonFields.birthYear`/`deathYear` — via `deriveLivingStatus`
 * (`./living.ts`). Returns `undefined` for non-person kinds (living status is only meaningful for
 * persons). This is a pure computation, not wired into `currentEntityStatus` or any publish
 * pipeline in this pass — callers decide when/whether to store the result on
 * `livingStatusDerived`.
 */
export function deriveEntityLivingStatus(entity: CanonicalEntity): LivingStatus | undefined {
  if (entity.kind !== 'person') return undefined;
  return deriveLivingStatus({
    ...(entity.person?.birthYear !== undefined ? { birthYear: entity.person.birthYear } : {}),
    ...(entity.person?.deathYear !== undefined ? { deathYear: entity.person.deathYear } : {}),
  });
}
