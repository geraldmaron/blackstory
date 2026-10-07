/**
 * Kind-specific entity status vocabularies, time-scoped status history, the notability-basis
 * inclusion rubric, and the entity-level sensitivity schema.
 *
 * SCOPE GUARDRAIL: `StatusHistoryEntry` `statusHistory` is ENTITY-LIFECYCLE status only
 * place/school/organization/institution active|historic|inactive, law
 * in_force|amended|repealed|struck_down|enjoined, movement active|historic. It never stores
 * area/condition designations (sundown-town, redlining grade, exclusion infrastructure) those
 * remain own time-scoped, evidence-backed layer records, following the same
 * {status, validFrom, validTo, datePrecision, basisClaimIds} *pattern* but living on a distinct
 * record type outside this module. If you find yourself wanting to add a place-condition value
 * into a StatusHistoryEntry.status, stop that belongs in, not here.
 */
import type { DatePrecision } from './era.js';
import type { LivingStatus } from './living.js';
import { treatAsLiving } from './living.js';

// ---------------------------------------------------------------------------
// Kind-specific status vocabularies
// ---------------------------------------------------------------------------

/** place | school | organization | institution share this vocabulary. */
export const PLACE_LIKE_STATUSES = ['active', 'historic', 'inactive'] as const;
export type PlaceLikeStatus = (typeof PLACE_LIKE_STATUSES)[number];

/** The exact vocabulary law badges import. */
export const LAW_STATUSES = ['in_force', 'amended', 'repealed', 'struck_down', 'enjoined'] as const;
export type LawStatus = (typeof LAW_STATUSES)[number];

/** Movements conclude, they don't pause deliberately no `inactive` value (stress-test
 * amendment). */
export const MOVEMENT_STATUSES = ['active', 'historic'] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export const PLACE_LIKE_STATUS_KINDS = ['place', 'school', 'organization', 'institution'] as const;
export type PlaceLikeStatusKind = (typeof PLACE_LIKE_STATUS_KINDS)[number];

/** Kinds that carry NO entity-level statusHistory field at all. `event` is when-span
 * authoritative (EventFields.startAt/endAt already say everything an eventthe "status" could);
 * `person` status derives from livingStatus instead of a second field (below). */
export const STATUSLESS_ENTITY_KINDS = ['event', 'person'] as const;
export type StatuslessEntityKind = (typeof STATUSLESS_ENTITY_KINDS)[number];

/** Union of every kind-specific status value statusHistory entries may carry. */
export type EntityStatusValue = PlaceLikeStatus | LawStatus | MovementStatus;

// ---------------------------------------------------------------------------
// Time-scoped status history
// ---------------------------------------------------------------------------

export type StatusHistoryEntry<S extends string = EntityStatusValue> = {
  readonly status: S;
  readonly validFrom?: string;
  /** Omitted or null means open-ended (still current as of now). */
  readonly validTo?: string | null;
  readonly datePrecision: DatePrecision;
  readonly basisClaimIds: readonly string[];
};

function isOpenEnded(entry: StatusHistoryEntry<string>): boolean {
  return entry.validTo === undefined || entry.validTo === null;
}

function latestByValidFrom<S extends string>(
  entries: readonly StatusHistoryEntry<S>[],
): StatusHistoryEntry<S> | undefined {
  return [...entries].sort((a, b) => (b.validFrom ?? '').localeCompare(a.validFrom ?? ''))[0];
}

/**
 * The current status is ALWAYS derived from the open-ended record (validTo omitted or null)
 * never hand-edited as an independent scalar field. If more than one open-ended record exists
 * (an upstream data-entry error), the one with the latest validFrom wins.
 */
export function currentStatus<S extends string>(
  history: readonly StatusHistoryEntry<S>[] | undefined,
): S | undefined {
  const openEnded = (history ?? []).filter(isOpenEnded);
  return latestByValidFrom(openEnded)?.status;
}

/**
 * Answers point-in-time questions ("what was this entity's status in decade D") against the
 * time-scoped statusHistory array: the record whose [validFrom, validTo) window contains `asOf`.
 * `asOf` and the validFrom/validTo bounds are compared as strings, so callers should pass
 * comparable ISO-ish values (a bare year like "1955" compares correctly against other bare
 * years; mixing precisions is the caller's responsibility, same as elsewhere in this package).
 */
export function statusAsOf<S extends string>(
  history: readonly StatusHistoryEntry<S>[] | undefined,
  asOf: string,
): S | undefined {
  const covering = (history ?? []).filter((entry) => {
    if (entry.validFrom !== undefined && asOf < entry.validFrom) return false;
    if (entry.validTo !== undefined && entry.validTo !== null && asOf >= entry.validTo)
      return false;
    return true;
  });
  return latestByValidFrom(covering)?.status;
}

// ---------------------------------------------------------------------------
// Person status derives from livingStatus never a second field
// ---------------------------------------------------------------------------

export type PersonDerivedStatus = 'living' | 'deceased';

/**
 * Person status DERIVES from livingStatus; unknown is treated as living per. No
 * independent statusHistory field exists on person entities a second source of truth would
 * drift against the living-person compliance lane.
 *
 * DISPLAY-FORBIDDEN: this governs privacy/redaction gates (treatAsLiving, commemorative-location
 * checks) ONLY. Never use this to render a public status badge — public display derives status
 * from `deriveCatalogEntityStatus` in derive-catalog-status.ts, which reports 'unknown' honestly
 * instead of collapsing it to 'living'.
 */
export function personStatusFromLiving(
  livingStatus: LivingStatus | undefined,
): PersonDerivedStatus {
  return treatAsLiving(livingStatus ?? 'unknown') ? 'living' : 'deceased';
}

// ---------------------------------------------------------------------------
// Notability basis an auditable inclusion rubric, never a score
// ---------------------------------------------------------------------------

export const NOTABILITY_CRITERIA = [
  'first_to_do_x',
  'major_honor_or_hall_of_fame',
  'landmark_or_national_register',
  'court_precedent',
  'movement_significance',
  'documented_site',
  'documented_contribution',
  'documented_racial_terror',
  'documented_racial_killing',
  'community_anchor',
  'only_or_oldest',
  'enacted_law',
  'elected_or_appointed_office',
  'black_press_or_archive',
  'documented_military_service',
] as const;

export type NotabilityCriterion = (typeof NOTABILITY_CRITERIA)[number];

export type NotabilityBasisRecord = {
  readonly criterion: NotabilityCriterion;
  readonly note: string;
  readonly evidenceIds: readonly string[];
};

/**
 * >=1 basis record is required to publish. This is a structural gate, not a score
 * numeric NotabilityScore fields are banned by standing policy from this record and from every
 * public payload derived from it (see packages/domain/src/relevance/notability-gate.ts, which
 * wires this check into the relevance-gate vocabulary as an 8th, additive gate).
 */
export function hasRequiredNotabilityBasis(
  notabilityBasis: readonly NotabilityBasisRecord[] | undefined,
): boolean {
  return (notabilityBasis?.length ?? 0) >= 1;
}

/**
 * Per-kind rubric text destined for the methodology definitions section. Reviewable,
 * ratify-able prose never a scoring formula. This is the auditable answer to "why is X in and
 * Y out" the product constitution calls.
 */
export const NOTABILITY_RUBRIC: Readonly<Record<NotabilityCriterion, string>> = {
  first_to_do_x:
    'A documented first by a Black person, institution or place. The record must name the ' +
    'achievement and the scope in which it was first.',
  major_honor_or_hall_of_fame:
    'A major national or field-defining honor or hall-of-fame induction. Local or ' +
    'purely commercial awards do not qualify on their own.',
  landmark_or_national_register:
    'A place or institution with a documented entry in a national, state or local landmark ' +
    'register. The record must identify the designation.',
  court_precedent:
    'A judicial decision or trial that set binding or widely cited precedent affecting Black ' +
    "Americans' rights or status, or marked a documented turning point in how the law was applied.",
  movement_significance:
    'A documented, non-incidental role in a named movement, such as organizing, leading, hosting or serving ' +
    'as a recognized site or symbol of the movement.',
  documented_site:
    'A physical site tied to a historically significant event or practice by primary-source ' +
    'evidence. An association with a city alone does not establish a specific site.',
  documented_contribution:
    'An invention, process, method or design documented by a patent or contemporary accounts ' +
    'of the work. A contribution can qualify without a patent.',
  community_anchor:
    'An institution with a documented role over multiple decades in a specific Black ' +
    'community, such as a church, lodge, college or mutual aid society.',
  documented_racial_terror:
    'A person killed in a documented act of racial terror, or the event or place where the ' +
    'killing occurred. Inclusion rests on evidence of the killing, never an accusation made ' +
    'against the person killed.',
  only_or_oldest:
    'The only or oldest surviving example of its kind within a defined area and comparison ' +
    'group. The evidence must support those limits.',
  documented_racial_killing:
    'A person killed in a documented case in which race was a documented element, or the ' +
    'event where the killing occurred. The record must cite evidence establishing that ' +
    'connection. Inclusion never rests on an accusation against the person killed.',
  enacted_law:
    'A statute, constitutional amendment, executive order or ordinance whose enactment or ' +
    'enforcement materially changed the rights, legal status or conditions of Black Americans. ' +
    'The record must explain the change, including harm where documented.',
  elected_or_appointed_office:
    'Documented service in elected or appointed public office, including legislative, ' +
    'executive, judicial or commission roles. A professional or institutional post alone ' +
    'does not qualify as public office.',
  black_press_or_archive:
    'A Black-owned or Black-edited publication, or an archive, library, research center or ' +
    'museum with a documented role in preserving or interpreting Black history.',
  documented_military_service:
    'Military service with documented significance in Black history, such as service in a ' +
    'segregated or newly integrated formation or breaking a barrier to enlistment or ' +
    'commissioning. The record must establish that significance; service alone is insufficient.',
};

/**
 * Cultural-figure notability calibration: ships as "icons & firsts only." Hall-of-fame
 * inductions, major national honors, documented firsts, and documented movement significance
 * qualify; commercial milestones (certifications, chart position, sales figures, box-office
 * gross) never qualify alone. This constant documents the calibration decision — it is
 * reviewable rubric text pending ratification (see docs/decisions-carryover.md, "Entity
 * ontology"), not a scoring threshold.
 */
export const CULTURAL_FIGURE_NOTABILITY_CALIBRATION = 'icons_and_firsts_only' as const;

export const CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE =
  'Cultural-figure inclusion (musicians, athletes, entertainers, and similar public figures) is ' +
  'calibrated to icons and firsts only: hall-of-fame induction, a major national honor, a ' +
  'documented first, or documented movement significance. Commercial success alone — record ' +
  'sales, certifications, chart position, box-office gross — never independently qualifies.';

// ---------------------------------------------------------------------------
// Sensitivity flag SCHEMA ONLY (presentation is)
// ---------------------------------------------------------------------------

export const SENSITIVITY_CLASSES = [
  'contested_legacy',
  'perpetrator_associated',
  'violence_associated',
  'enslaver_or_segregationist',
] as const;

export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

/**
 * Entity-level sensitivity classification schema only. Presentation (disclaimers, content
 * warnings, UI treatment) lives elsewhere. Distinct from two other similarly-adjacent concerns
 * that must not be conflated with it: living-person compliance (privacy/consent handling for
 * the living) and location sensitivity classes (e.g. sundown-town / redlining-grade
 * place-condition designations, which are never stored here or in
 * `CanonicalEntity.statusHistory`).
 */
export type EntitySensitivity = {
  readonly class: SensitivityClass;
  readonly note: string;
  readonly basisClaimIds: readonly string[];
};
