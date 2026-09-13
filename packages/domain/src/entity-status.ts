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
    'The entity (case, law, person) is tied to a judicial decision — a ruling, an opinion, or a ' +
    'trial — that set binding or widely cited precedent affecting Black Americans\u2019 rights ' +
    'or status, or that was itself a documented turning point in how the law was applied to ' +
    'Black Americans. The trial of Anthony Burns set no precedent and made the Fugitive Slave ' +
    'Act visible in Boston; the Amistad and Creole cases are here on the same footing.',
  movement_significance:
    'The entity (person, organization, event, place, or a movement-kind entity itself) played a ' +
    'documented, non-incidental role in a named movement (Civil Rights Movement, Great ' +
    'Migration, Black Power, Black Arts Movement, etc.) — organizing, leading, hosting, or being ' +
    'a recognized site or symbol of it.',
  documented_site:
    'The entity is a documented site of a historically significant event or practice (a sit-in ' +
    'lunch counter, a Freedom School, a documented station on the Underground Railroad) with ' +
    'primary-source evidence tying the site to the event.',
  documented_contribution:
    'The entity is a documented contribution to a field — an invention, process, method, or ' +
    'design — evidenced either by the grant that records it or, where the patent system was ' +
    'closed to the person who made it, by contemporary accounts of the work itself. A patent is ' +
    'a receipt, not the definition: Benjamin Banneker built a striking clock in the 1750s, and ' +
    'no grant was available to him for it.',
  community_anchor:
    'The entity served as a long-standing, evidenced community anchor institution (a ' +
    'historically Black church, fraternal lodge, HBCU, mutual aid society) with a documented ' +
    'multi-decade role in a specific community.',
  documented_racial_terror:
    'The entity is a person killed in a documented act of racial terror — a lynching or other ' +
    'extrajudicial racial killing — or the event or place where such a killing is documented. ' +
    'The basis for inclusion is the killing and its documentation, never an accusation made ' +
    "against the person killed: the Equal Justice Initiative's Lynching in America research " +
    'records that nearly every victim was killed without being legally convicted of any ' +
    'offense, and that such accusations were routinely fabricated and rarely investigated. ' +
    'The record names the person so the killing is not anonymous.',
  only_or_oldest:
    'The entity is documented as the only or oldest surviving example of its kind in a defined ' +
    'scope (oldest Black-owned business in a city, only remaining Rosenwald school in a county) ' +
    'with evidence supporting the superlative claim.',
  documented_racial_killing:
    'The entity is a person killed in a documented killing in which race is a documented element ' +
    'of the case \u2014 by police, by someone acting under a claim of authority or self-defense, ' +
    'or by a private individual \u2014 or the event where such killings are documented. The ' +
    'killing and the public record it produced are the reason the record exists. It is distinct from documented racial terror, which names the ' +
    'lynching era and the white-supremacist attack: the two rest on different documentary ' +
    'records, the Equal Justice Initiative\u2019s Lynching in America research on one side and ' +
    'investigations, grand jury proceedings, federal findings and consent decrees on the other, ' +
    'and each record cites its own. As with racial terror, the basis for inclusion is never an ' +
    'accusation made against the person killed.',
  enacted_law:
    'The entity is a statute, constitutional amendment, executive order or ordinance whose ' +
    'enactment or enforcement materially changed the legal status, rights or conditions of Black ' +
    'Americans. The criterion is neutral as to direction and the record says which: the ' +
    'Mississippi Black Codes of 1865, the Fugitive Slave Act of 1850 and the National Housing ' +
    'Act of 1934 are here for the harm they codified, exactly as the Voting Rights Act of 1965 ' +
    'is here for what it dismantled. A law is never filed under a criterion that reads as an ' +
    'achievement.',
  elected_or_appointed_office:
    'The entity is a person documented as holding elected or appointed public office \u2014 ' +
    'legislative, executive, judicial, or a commission \u2014 where the holding of that office ' +
    'is itself the documented fact. Eric Foner\u2019s Freedom\u2019s Lawmakers establishes the ' +
    'more than 1,500 Black officeholders of Reconstruction as a cohort recorded for the office ' +
    'they held, from United States congressmen to justices of the peace and constables, rather ' +
    'than for a separate achievement, and this criterion carries that reading forward. A ' +
    'professional or institutional post is not public office and does not qualify here.',
  black_press_or_archive:
    'The entity created, preserved or interprets the documentary record of Black life: a ' +
    'Black-owned or Black-edited newspaper, periodical or guide, or an archive, library, ' +
    'research center or museum of Black history. These exist because the mainstream record ' +
    'excluded, distorted or ignored Black Americans \u2014 Freedom\u2019s Journal opened in ' +
    '1827 with \u201cWe wish to plead our own cause. Too long have others spoken for us.\u201d ' +
    'The basis is the documented role in making or keeping that record, and it is a role this ' +
    'catalog depends on: these are among the sources it cites.',
  documented_military_service:
    'The entity (a person, unit or regiment) has a documented record of military service that ' +
    'is itself the reason it is here: service in a segregated or newly integrated formation, ' +
    'a first commission or enlistment that broke a service\u2019s color line, or a unit raised ' +
    'specifically from Black or Black and Native soldiers. Service alone is not the basis \u2014 ' +
    'the record has to show the service carried that weight, which is why the 91st United ' +
    'States Colored Infantry and the Golden Thirteen sit here rather than under ' +
    '`documented_site`, the honest-but-wrong fallback they inherited before this criterion ' +
    'existed.',
};

/**
 * Cultural-figure notability calibration: ships as "icons & firsts only." Hall-of-fame
 * inductions, major national honors, documented firsts, and documented movement significance
 * qualify; commercial milestones (certifications, chart position, sales figures, box-office
 * gross) never qualify alone. This constant documents the calibration decision — it is
 * reviewable rubric text pending ratification (see ADR-015), not a scoring threshold.
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
