/**
 * Deterministic status derivation helpers for WS3 backfill lanes (person, place, law).
 * Pure functions only — DB I/O lives in lane scripts.
 */
import {
  MAX_PLAUSIBLE_HUMAN_AGE_YEARS,
  RECENT_LIFE_EVIDENCE_YEARS,
  deriveLivingStatus,
  type LivingStatus,
} from '../../../domain/src/living.ts';
import type { LawStatus, PlaceLikeStatus, StatusHistoryEntry } from '../../../domain/src/entity-status.ts';

export type LivingStatusDerivedRecord = {
  readonly status: LivingStatus;
  readonly signal: PersonLivingSignal;
  readonly basisClaimIds: readonly string[];
  readonly deathEdtf?: string;
  readonly birthYear?: number;
  readonly derivedAt: string;
  readonly lane: 'deterministic';
};

export type PersonLivingSignal =
  | 'death_claim'
  | 'death_qualifier'
  | 'bdp_rule'
  | 'no_signal';

export type PersonClaimRow = {
  readonly claimId: string;
  readonly predicate: string;
  readonly object: string;
};

export type PersonQualifierRow = {
  readonly claimId: string;
  readonly predicate: string;
  readonly property: string;
  readonly edtf: string | null;
};

/** Death-bearing claim predicates (deterministic auto-write lane). */
export const DEATH_BEARING_PREDICATE_RE =
  /(?:^|[^a-z0-9_])(?:lynch(?:ed|ing)?|was_killed_in|killed(?:_on|_in)?|died(?:_in|_on)?|death|assassinat(?:ed|ion)?(?:_on)?|hanged|buried(?:_at|_in)?|date_of_death)(?:[^a-z0-9_]|$)/i;

export const DEATH_PREDICATE_RE =
  /\b(death|died|death_year|deathdate|date_of_death|deceased)\b/i;

export const BIRTH_PREDICATE_RE =
  /\b(birth|born|birth_year|birthdate|date_of_birth)\b/i;

export const LIFE_EVIDENCE_PREDICATE_RE =
  /\b(appointed|elected|published|graduated|served|retired|honored|awarded|inducted|directed|founded|organized)\b/i;

export function isDeathBearingPredicate(predicate: string): boolean {
  return DEATH_BEARING_PREDICATE_RE.test(predicate);
}

export function isDeathPredicate(predicate: string): boolean {
  return DEATH_PREDICATE_RE.test(predicate);
}

export function parseBareYear(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(1[0-9]{3}|20[0-9]{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

export function extractYearFromObject(object: unknown): number | null {
  if (typeof object === 'number' && Number.isFinite(object)) return object;
  if (typeof object === 'string') return parseBareYear(object);
  if (typeof object === 'string' && object.startsWith('"')) {
    return parseBareYear(JSON.parse(object) as string);
  }
  return null;
}

function uniqueClaimIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids.filter(Boolean))];
}

function deathClaims(claims: readonly PersonClaimRow[]): readonly PersonClaimRow[] {
  return claims.filter((c) => isDeathBearingPredicate(c.predicate));
}

function deathQualifiers(qualifiers: readonly PersonQualifierRow[]): readonly PersonQualifierRow[] {
  return qualifiers.filter((q) => isDeathPredicate(q.predicate) && q.edtf);
}

function earliestBirthYear(
  claims: readonly PersonClaimRow[],
  kindDetailBirthYear?: number | null,
): number | null {
  const years: number[] = [];
  if (kindDetailBirthYear !== undefined && kindDetailBirthYear !== null) {
    years.push(kindDetailBirthYear);
  }
  for (const claim of claims) {
    if (!BIRTH_PREDICATE_RE.test(claim.predicate)) continue;
    const year = parseBareYear(claim.object);
    if (year !== null) years.push(year);
  }
  if (years.length === 0) return null;
  return Math.min(...years);
}

/** True when a claim year falls within the recent-life evidence window. */
export function hasRecentLifeEvidenceFromClaims(
  claims: readonly PersonClaimRow[],
  asOfYear: number = new Date().getUTCFullYear(),
): boolean {
  const cutoff = asOfYear - RECENT_LIFE_EVIDENCE_YEARS;
  for (const claim of claims) {
    if (!LIFE_EVIDENCE_PREDICATE_RE.test(claim.predicate)) continue;
    const year = parseBareYear(claim.object);
    if (year !== null && year >= cutoff) return true;
  }
  return false;
}

/**
 * Derives person living status from deterministic signals only.
 * Priority: death claim > death qualifier > WP:BDP (presumed_deceased).
 */
export function derivePersonLivingStatusDeterministic(input: {
  readonly claims: readonly PersonClaimRow[];
  readonly qualifiers: readonly PersonQualifierRow[];
  readonly kindDetailBirthYear?: number | null;
  readonly kindDetailDeathEdtf?: string | null;
  readonly asOfYear?: number;
}): LivingStatusDerivedRecord {
  const asOfYear = input.asOfYear ?? new Date().getUTCFullYear();
  const derivedAt = new Date().toISOString();

  const deathClaimRows = deathClaims(input.claims);
  if (deathClaimRows.length > 0) {
    return {
      status: 'deceased',
      signal: 'death_claim',
      basisClaimIds: uniqueClaimIds(deathClaimRows.map((c) => c.claimId)),
      derivedAt,
      lane: 'deterministic',
    };
  }

  const deathQualRows = deathQualifiers(input.qualifiers);
  if (deathQualRows.length > 0) {
    const deathEdtf = deathQualRows[0]!.edtf ?? input.kindDetailDeathEdtf ?? undefined;
    return {
      status: 'deceased',
      signal: 'death_qualifier',
      basisClaimIds: uniqueClaimIds(deathQualRows.map((q) => q.claimId)),
      ...(deathEdtf ? { deathEdtf } : {}),
      derivedAt,
      lane: 'deterministic',
    };
  }

  const birthYear = earliestBirthYear(input.claims, input.kindDetailBirthYear);
  if (birthYear !== null) {
    const recentLifeEvidence = hasRecentLifeEvidenceFromClaims(input.claims, asOfYear);
    const status = deriveLivingStatus({
      birthYear,
      asOfYear,
      recentLifeEvidence,
    });
    if (status === 'presumed_deceased') {
      return {
        status: 'presumed_deceased',
        signal: 'bdp_rule',
        basisClaimIds: uniqueClaimIds(
          input.claims.filter((c) => BIRTH_PREDICATE_RE.test(c.predicate)).map((c) => c.claimId),
        ),
        birthYear,
        derivedAt,
        lane: 'deterministic',
      };
    }
  }

  return {
    status: 'unknown',
    signal: 'no_signal',
    basisClaimIds: [],
    derivedAt,
    lane: 'deterministic',
  };
}

export type TerminalStatusFix = {
  readonly entityId: string;
  readonly displayName: string;
  readonly priorStatus: string;
  readonly nextStatus: LawStatus | PlaceLikeStatus;
  readonly validFrom: string;
  /** Required for terminal transitions; ignored when rewriteMode is replace. */
  readonly validTo: string;
  readonly datePrecision: 'year';
  readonly basisClaimIds: readonly string[];
  readonly note: string;
  /** Replace entire history (wrong prior snapshot) instead of closing an open entry. */
  readonly rewriteMode?: 'terminal' | 'replace';
};

export const STATUS_REVIEW_LANE = 'status-review' as const;
export const STATUS_REVIEW_PROGRAM_ID = 'entity-status-integrity' as const;

export function statusReviewRunId(asOf: Date = new Date()): string {
  return `status-review-${asOf.toISOString().slice(0, 10)}`;
}

/** Builds a two-entry status_history closing an open-ended prior snapshot. */
export function buildTerminalStatusHistory(
  prior: readonly StatusHistoryEntry<string>[],
  fix: Pick<TerminalStatusFix, 'priorStatus' | 'nextStatus' | 'validFrom' | 'validTo' | 'datePrecision' | 'basisClaimIds'>,
): readonly StatusHistoryEntry<string>[] {
  const open = prior.find((e) => e.validTo === undefined || e.validTo === null);
  const closedPrior: StatusHistoryEntry<string> = open
    ? {
        ...open,
        validTo: fix.validTo,
      }
    : {
        status: fix.priorStatus,
        validFrom: fix.validFrom,
        validTo: fix.validTo,
        datePrecision: fix.datePrecision,
        basisClaimIds: fix.basisClaimIds,
      };
  const terminal: StatusHistoryEntry<string> = {
    status: fix.nextStatus,
    validFrom: fix.validTo,
    validTo: null,
    datePrecision: fix.datePrecision,
    basisClaimIds: fix.basisClaimIds,
  };
  const preserved = prior.filter((e) => e !== open);
  return [...preserved, closedPrior, terminal];
}

/** Rewrites status_history to a single open-ended entry (prior snapshot was wrong). */
export function buildCorrectedStatusHistory(
  fix: Pick<TerminalStatusFix, 'nextStatus' | 'validFrom' | 'datePrecision' | 'basisClaimIds'>,
): readonly StatusHistoryEntry<string>[] {
  return [
    {
      status: fix.nextStatus,
      validFrom: fix.validFrom,
      validTo: null,
      datePrecision: fix.datePrecision,
      basisClaimIds: fix.basisClaimIds,
    },
  ];
}

export function applyStatusFix(
  prior: readonly StatusHistoryEntry<string>[],
  fix: TerminalStatusFix,
): readonly StatusHistoryEntry<string>[] {
  if (fix.rewriteMode === 'replace') {
    return buildCorrectedStatusHistory(fix);
  }
  return buildTerminalStatusHistory(prior, fix);
}

/** Known wrong law fixes (item-level review pass). */
export const LAW_STATUS_FIXES: readonly TerminalStatusFix[] = [
  {
    entityId: 'ent_law_civil_rights_act_1875',
    displayName: 'Civil Rights Act of 1875',
    priorStatus: 'in_force',
    nextStatus: 'struck_down',
    validFrom: '1875',
    validTo: '1883',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_civil_rights_act_1875_claim_0',
      'ent_law_civil_rights_act_1875_claim_1',
    ],
    note: 'Civil Rights Cases (1883) struck down public-accommodations provisions.',
  },
  {
    entityId: 'ent_law_fugitive_slave_act_1850',
    displayName: 'Fugitive Slave Act of 1850',
    priorStatus: 'in_force',
    nextStatus: 'repealed',
    validFrom: '1850',
    validTo: '1864',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_fugitive_slave_act_1850_claim_0',
      'ent_law_fugitive_slave_act_1850_claim_1',
    ],
    note: 'Repealed June 1864 during the Civil War.',
  },
  {
    entityId: 'ent_law_14th_amendment_1868',
    displayName: 'Fourteenth Amendment to the U.S. Constitution',
    priorStatus: 'repealed',
    nextStatus: 'in_force',
    validFrom: '1868',
    validTo: '1868',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_14th_amendment_1868_claim_0',
      'ent_law_14th_amendment_1868_claim_1',
    ],
    note: 'Ratified 1868; prior repealed snapshot was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_law_louisiana_separate_car_act_1890',
    displayName: 'Louisiana Separate Car Act of 1890',
    priorStatus: 'in_force',
    nextStatus: 'struck_down',
    validFrom: '1890',
    validTo: '1964',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_louisiana_separate_car_act_1890_claim_0',
      'ent_law_louisiana_separate_car_act_1890_claim_1',
    ],
    note: 'Struck down by Civil Rights Act of 1964 and interstate commerce desegregation.',
  },
  {
    entityId: 'ent_law_mississippi_black_codes_1865',
    displayName: 'Mississippi Black Codes of 1865',
    priorStatus: 'in_force',
    nextStatus: 'repealed',
    validFrom: '1865',
    validTo: '1868',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_mississippi_black_codes_1865_claim_0',
      'ent_law_mississippi_black_codes_1865_claim_1',
    ],
    note: 'Repealed during Reconstruction (1868).',
  },
  {
    entityId: 'ent_law_south_carolina_black_codes_1865',
    displayName: 'South Carolina Black Codes of 1865',
    priorStatus: 'in_force',
    nextStatus: 'repealed',
    validFrom: '1865',
    validTo: '1868',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_south_carolina_black_codes_1865_claim_0',
      'ent_law_south_carolina_black_codes_1865_claim_1',
    ],
    note: 'Repealed during Reconstruction (1868).',
  },
  {
    entityId: 'ent_law_virginia_racial_integrity_act_1924',
    displayName: 'Virginia Racial Integrity Act of 1924',
    priorStatus: 'in_force',
    nextStatus: 'struck_down',
    validFrom: '1924',
    validTo: '1967',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_virginia_racial_integrity_act_1924_claim_0',
      'ent_law_virginia_racial_integrity_act_1924_claim_1',
    ],
    note: 'Struck down by Loving v. Virginia (1967).',
  },
  {
    entityId: 'ent_law_missouri_compromise_1820',
    displayName: 'Missouri Compromise',
    priorStatus: 'in_force',
    nextStatus: 'repealed',
    validFrom: '1820',
    validTo: '1854',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_missouri_compromise_1820_claim_0',
      'ent_law_missouri_compromise_1820_claim_1',
    ],
    note: 'Repealed by the Kansas-Nebraska Act (1854).',
  },
  {
    entityId: 'ent_law_kansas_nebraska_act_1854',
    displayName: 'Kansas-Nebraska Act',
    priorStatus: 'in_force',
    nextStatus: 'repealed',
    validFrom: '1854',
    validTo: '1865',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_kansas_nebraska_act_1854_claim_0',
      'ent_law_kansas_nebraska_act_1854_claim_1',
    ],
    note: 'Superseded by Civil War settlement and the Thirteenth Amendment (1865).',
  },
  {
    entityId: 'ent_law_freedmens_bureau_act_1865',
    displayName: "Freedmen's Bureau Act of 1865",
    priorStatus: 'in_force',
    nextStatus: 'repealed',
    validFrom: '1865',
    validTo: '1872',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_law_freedmens_bureau_act_1865_claim_0',
      'ent_law_freedmens_bureau_act_1865_claim_1',
    ],
    note: 'Bureau wound down and authorization lapsed (~1872).',
  },
];

/** Case fixes where summary and open status clearly disagree. */
export const CASE_STATUS_FIXES: readonly TerminalStatusFix[] = [];

const LAW_SELF_DEMISE_SUMMARY_RE =
  /\b(repealed|struck down|overturned|ruled unconstitutional|enjoined)\b/i;

export function caseSummaryText(kindDetail: unknown): string {
  if (typeof kindDetail !== 'object' || kindDetail === null) return '';
  const editorial = (kindDetail as { editorial?: { summary?: string; historicalContext?: string } })
    .editorial;
  return `${editorial?.summary ?? ''} ${editorial?.historicalContext ?? ''}`.trim();
}

export function caseNeedsStatusReview(input: {
  readonly entityId: string;
  readonly openStatus?: string;
  readonly kindDetail: unknown;
}): boolean {
  if (input.openStatus !== 'in_force') return false;
  return LAW_SELF_DEMISE_SUMMARY_RE.test(caseSummaryText(input.kindDetail));
}

/** Place-like wrong-set fixes from the status audit. */
export const PLACE_STATUS_FIXES: readonly TerminalStatusFix[] = [
  {
    entityId: 'ent_mill_creek_valley_stl_001',
    displayName: 'Mill Creek Valley',
    priorStatus: 'active',
    nextStatus: 'historic',
    validFrom: '1900',
    validTo: '1959',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_mill_creek_valley_stl_001_claim_0',
      'ent_mill_creek_valley_stl_001_claim_1',
    ],
    note: 'Urban renewal demolition closed the neighborhood in 1959.',
  },
  {
    entityId: 'ent_negro_fort_001',
    displayName: 'Negro Fort at Prospect Bluff',
    priorStatus: 'active',
    nextStatus: 'historic',
    validFrom: '1810',
    validTo: '1816',
    datePrecision: 'year',
    basisClaimIds: ['ent_negro_fort_001_claim_0', 'ent_negro_fort_001_claim_1'],
    note: 'Fort destroyed 1816; site is historic only.',
  },
  {
    entityId: 'ent_charles_wright_museum_001',
    displayName: 'Charles H. Wright Museum of African American History',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1965',
    validTo: '1965',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_charles_wright_museum_001_claim_0',
      'ent_charles_wright_museum_001_claim_1',
    ],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_african_american_museum_cleveland_001',
    displayName: 'African American Museum in Cleveland',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1984',
    validTo: '1984',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_african_american_museum_cleveland_001_claim_0',
      'ent_african_american_museum_cleveland_001_claim_1',
    ],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_aamp_philadelphia_001',
    displayName: 'African American Museum in Philadelphia',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1976',
    validTo: '1976',
    datePrecision: 'year',
    basisClaimIds: ['ent_aamp_philadelphia_001_claim_0', 'ent_aamp_philadelphia_001_claim_1'],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_african_american_museum_dallas_001',
    displayName: 'African American Museum, Dallas',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1974',
    validTo: '1974',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_african_american_museum_dallas_001_claim_0',
      'ent_african_american_museum_dallas_001_claim_1',
    ],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_americas_black_holocaust_museum_001',
    displayName: "America's Black Holocaust Museum",
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1988',
    validTo: '1988',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_americas_black_holocaust_museum_001_claim_0',
      'ent_americas_black_holocaust_museum_001_claim_1',
    ],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_freedom_rides_museum_001',
    displayName: 'Freedom Rides Museum (Montgomery Greyhound Station)',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '2011',
    validTo: '2011',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_freedom_rides_museum_001_claim_0',
      'ent_freedom_rides_museum_001_claim_1',
    ],
    note: 'Operating visitor site; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_iaam_charleston_001',
    displayName: 'International African American Museum',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '2023',
    validTo: '2023',
    datePrecision: 'year',
    basisClaimIds: ['ent_iaam_charleston_001_claim_0', 'ent_iaam_charleston_001_claim_1'],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_little_rock_central_high_001',
    displayName: 'Little Rock Central High School National Historic Site',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1927',
    validTo: '1927',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_little_rock_central_high_001_claim_0',
      'ent_little_rock_central_high_001_claim_1',
    ],
    note: 'Operating NHS visitor site; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_little_rock_central_high_school_001',
    displayName: 'Little Rock Central High School',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1927',
    validTo: '1927',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_little_rock_central_high_school_001_claim_0',
      'ent_little_rock_central_high_school_001_claim_1',
    ],
    note: 'School still operating; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_northwest_african_american_museum_001',
    displayName: 'Northwest African American Museum',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '2008',
    validTo: '2008',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_northwest_african_american_museum_001_claim_0',
      'ent_northwest_african_american_museum_001_claim_1',
    ],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_rosa_parks_museum_001',
    displayName: 'Rosa Parks Museum',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '2000',
    validTo: '2000',
    datePrecision: 'year',
    basisClaimIds: [
      'ent_rosa_parks_museum_001_claim_0',
      'ent_rosa_parks_museum_001_claim_1',
    ],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_legacy_museum_eji_001',
    displayName: 'The Legacy Museum',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '2018',
    validTo: '2018',
    datePrecision: 'year',
    basisClaimIds: ['ent_legacy_museum_eji_001_claim_0', 'ent_legacy_museum_eji_001_claim_1'],
    note: 'Operating institution; historic label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'ent_pullman_porters_001',
    displayName: 'Pullman National Historical Park — A. Philip Randolph Pullman Porter Museum',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1894',
    validTo: '1894',
    datePrecision: 'year',
    basisClaimIds: ['ent_pullman_porters_001_claim_0', 'ent_pullman_porters_001_claim_1'],
    note: 'Operating NPS historical park and museum; historic-only label was incorrect.',
    rewriteMode: 'replace',
  },
  {
    entityId: 'dc-black-history-sites-i38',
    displayName:
      'Frederick Douglass House/Museum of African Art/Frederick Douglass Museum and Hall of Fame for Caring Americans',
    priorStatus: 'historic',
    nextStatus: 'active',
    validFrom: '1870',
    validTo: '1870',
    datePrecision: 'year',
    basisClaimIds: [
      'dc-black-history-sites-i38_claim_0',
      'dc-black-history-sites-i38_claim_1',
      'dc-black-history-sites-i38_claim_2',
      'dc-black-history-sites-i38_claim_3',
    ],
    note: 'Operating historic house/museum sites; historic-only label was incorrect (compound DC sites row).',
    rewriteMode: 'replace',
  },
];

export const PLACE_STATUS_FIX_ENTITY_IDS = new Set(
  PLACE_STATUS_FIXES.map((fix) => fix.entityId),
);

export { MAX_PLAUSIBLE_HUMAN_AGE_YEARS, RECENT_LIFE_EVIDENCE_YEARS };
