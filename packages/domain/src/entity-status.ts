/**
 * Kind-specific entity status vocabularies, time-scoped status history, the notability-basis
 * inclusion rubric, and the entity-level sensitivity schema (BB-090).
 *
 * SCOPE GUARDRAIL: `StatusHistoryEntry` / `statusHistory` is ENTITY-LIFECYCLE status only —
 * place/school/organization/institution active|historic|inactive, law
 * in_force|amended|repealed|struck_down|enjoined, movement active|historic. It never stores
 * area/condition designations (sundown-town, redlining grade, exclusion infrastructure) — those
 * remain BB-082's own time-scoped, evidence-backed layer records, following the same
 * {status, validFrom, validTo, datePrecision, basisClaimIds} *pattern* but living on a distinct
 * record type outside this module. If you find yourself wanting to add a place-condition value
 * into a StatusHistoryEntry.status, stop — that belongs in BB-082, not here.
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

/** The exact vocabulary BB-087 law badges import. */
export const LAW_STATUSES = ['in_force', 'amended', 'repealed', 'struck_down', 'enjoined'] as const;
export type LawStatus = (typeof LAW_STATUSES)[number];

/** Movements conclude, they don't pause — deliberately no `inactive` value (BB-090 stress-test
 * amendment). */
export const MOVEMENT_STATUSES = ['active', 'historic'] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export const PLACE_LIKE_STATUS_KINDS = ['place', 'school', 'organization', 'institution'] as const;
export type PlaceLikeStatusKind = (typeof PLACE_LIKE_STATUS_KINDS)[number];

/** Kinds that carry NO entity-level statusHistory field at all. `event` is when-span
 * authoritative (EventFields.startAt/endAt already say everything an event's "status" could);
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
 * The current status is ALWAYS derived from the open-ended record (validTo omitted or null) —
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
    if (entry.validTo !== undefined && entry.validTo !== null && asOf >= entry.validTo) return false;
    return true;
  });
  return latestByValidFrom(covering)?.status;
}

// ---------------------------------------------------------------------------
// Person status derives from livingStatus — never a second field (BB-015)
// ---------------------------------------------------------------------------

export type PersonDerivedStatus = 'living' | 'deceased';

/**
 * Person status DERIVES from livingStatus; unknown is treated as living per BB-015. No
 * independent statusHistory field exists on person entities — a second source of truth would
 * drift against the living-person compliance lane.
 */
export function personStatusFromLiving(livingStatus: LivingStatus | undefined): PersonDerivedStatus {
  return treatAsLiving(livingStatus ?? 'unknown') ? 'living' : 'deceased';
}

// ---------------------------------------------------------------------------
// Notability basis — an auditable inclusion rubric, never a score
// ---------------------------------------------------------------------------

export const NOTABILITY_CRITERIA = [
  'first_to_do_x',
  'major_honor_or_hall_of_fame',
  'landmark_or_national_register',
  'court_precedent',
  'movement_significance',
  'documented_site',
  'community_anchor',
  'only_or_oldest',
] as const;

export type NotabilityCriterion = (typeof NOTABILITY_CRITERIA)[number];

export type NotabilityBasisRecord = {
  readonly criterion: NotabilityCriterion;
  readonly note: string;
  readonly evidenceIds: readonly string[];
};

/**
 * >=1 basis record is required to publish (BB-090 AC3). This is a structural gate, not a score —
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
 * Per-kind rubric text destined for the BB-088 methodology definitions section. Reviewable,
 * ratify-able prose — never a scoring formula. This is the auditable answer to "why is X in and
 * Y out" the product constitution calls for.
 */
export const NOTABILITY_RUBRIC: Readonly<Record<NotabilityCriterion, string>> = {
  first_to_do_x:
    'The entity is documented as the first Black person, institution, or place to achieve, ' +
    'hold, found, or integrate something notable (a role, office, degree, business, record) — ' +
    'not merely an early or contemporaneous participant.',
  major_honor_or_hall_of_fame:
    'The entity received a major, named national or field-defining honor or hall-of-fame ' +
    'induction (e.g. Congressional Gold Medal, a national Hall of Fame, a Pulitzer, a National ' +
    'Medal). Local or purely commercial awards do not qualify alone.',
  landmark_or_national_register:
    'The entity (place, school, institution) holds a formal landmark designation — National ' +
    'Register of Historic Places, National Historic Landmark, or an equivalent state/local ' +
    'landmark register entry — with documented listing evidence.',
  court_precedent:
    "The entity (case, law, person) is tied to a judicial decision that set binding or widely " +
    "cited precedent affecting Black Americans' rights or status.",
  movement_significance:
    'The entity (person, organization, event, place, or a movement-kind entity itself) played a ' +
    'documented, non-incidental role in a named movement (Civil Rights Movement, Great ' +
    'Migration, Black Power, Black Arts Movement, etc.) — organizing, leading, hosting, or being ' +
    'a recognized site or symbol of it.',
  documented_site:
    'The entity is a documented site of a historically significant event or practice (a sit-in ' +
    'lunch counter, a Freedom School, a documented station on the Underground Railroad) with ' +
    'primary-source evidence tying the site to the event.',
  community_anchor:
    'The entity served as a long-standing, evidenced community anchor institution (a ' +
    'historically Black church, fraternal lodge, HBCU, mutual aid society) with a documented ' +
    'multi-decade role in a specific community.',
  only_or_oldest:
    'The entity is documented as the only or oldest surviving example of its kind in a defined ' +
    'scope (oldest Black-owned business in a city, only remaining Rosenwald school in a county) ' +
    'with evidence supporting the superlative claim.',
};

/**
 * Cultural-figure notability calibration (owner brief 2026-07-17): ships as "icons & firsts
 * only." Hall-of-fame inductions, major national honors, documented firsts, and documented
 * movement significance qualify; commercial milestones (certifications, chart position, sales
 * figures, box-office gross) never qualify alone. This constant documents the calibration
 * decision — it is reviewable rubric text pending owner ratification (see ADR-015), not a
 * scoring threshold, and is the basis BB-094 will later auto-derive candidate notability from.
 */
export const CULTURAL_FIGURE_NOTABILITY_CALIBRATION = 'icons_and_firsts_only' as const;

export const CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE =
  'Cultural-figure inclusion (musicians, athletes, entertainers, and similar public figures) is ' +
  'calibrated to icons and firsts only: hall-of-fame induction, a major national honor, a ' +
  'documented first, or documented movement significance. Commercial success alone — record ' +
  'sales, certifications, chart position, box-office gross — never independently qualifies.';

// ---------------------------------------------------------------------------
// Sensitivity flag — SCHEMA ONLY (presentation is BB-095)
// ---------------------------------------------------------------------------

export const SENSITIVITY_CLASSES = [
  'contested_legacy',
  'perpetrator_associated',
  'violence_associated',
  'enslaver_or_segregationist',
] as const;

export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

/**
 * Entity-level sensitivity classification — schema only. Presentation (disclaimers, content
 * warnings, UI treatment) is BB-095's job, not this bead's. Distinct from two other,
 * similarly-adjacent concerns that must not be conflated with it: BB-015 living-person
 * compliance (privacy/consent handling for the living) and location sensitivity classes (e.g.
 * BB-082's sundown-town / redlining-grade place-condition designations, which are never stored
 * here or in `CanonicalEntity.statusHistory`).
 */
export type EntitySensitivity = {
  readonly class: SensitivityClass;
  readonly note: string;
  readonly basisClaimIds: readonly string[];
};
