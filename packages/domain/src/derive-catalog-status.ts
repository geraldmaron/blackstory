/**
 * Deterministic status derivation for catalog / release entities that lack an
 * authored `statusHistory`. Heuristics use kind + summary/era signals only —
 * never invents status for `event` (when-span authoritative) and returns
 * `livingStatus` hints for `person` instead of statusHistory.
 */
import type { LivingStatus } from './living.js';
import {
  PLACE_LIKE_STATUS_KINDS,
  type EntityStatusValue,
  type LawStatus,
  type MovementStatus,
  type PlaceLikeStatus,
  type StatusHistoryEntry,
} from './entity-status.js';

export type CatalogStatusSource = {
  readonly id: string;
  readonly kind: string;
  readonly displayName?: string;
  readonly summary?: string;
  readonly historicalContext?: string;
  readonly eraBuckets?: readonly string[];
  readonly claims?: readonly {
    readonly id?: string;
    readonly predicate?: string;
    readonly object?: string;
  }[];
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  readonly status?: string;
  readonly livingStatus?: LivingStatus;
  /** Distinct-source-document coverage, used to tell a researched record from a bare listing. */
  readonly researchCoverage?: string;
};

export type DerivedCatalogStatus = {
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  /** Derived current status label for public projections. */
  readonly status?: EntityStatusValue | 'living' | 'deceased' | 'presumed_deceased' | 'unknown';
  readonly livingStatus?: LivingStatus;
};

const HISTORIC_RE =
  /\b(former|defunct|demolished|abandoned|ruins?|destroyed|closed in|ceased|no longer|was (a|an|the)|historic site|archaeological)\b/i;
const ACTIVE_RE =
  /\b(still (operates|operating|stands|serves|open)|remains (a|an|in)|continues to|currently|today\b|present[- ]day|active (congregation|campus|museum|university|school|church))\b/i;

/**
 * A DATED or definite terminal-closure statement about the subject: "closed in 1963",
 * "operated until 1952", "closed its doors by the 1960s", "was demolished", "no longer stands".
 *
 * This exists because HISTORIC_RE and ACTIVE_RE routinely BOTH match one summary — a record that
 * says "closed in 1968" and later "a marker stands today" — and the old precedence let the
 * generic active cue win. Measured on release rel_20260723_authority_net_001: 18 published
 * entities carried status 'active' while their own prose stated closure or demolition (Mill
 * Creek Valley, demolished 1959, read as active). A dated closure is the stronger statement and
 * wins, unless the prose also says the subject reopened.
 *
 * Deliberately NOT in this set: bare "razed"/"burned down" (fires and razings are routinely
 * followed by rebuilding — Emanuel AME's razed 1822 predecessor belongs to an active
 * congregation), and undated "demolished" without "was" (Craven Terrace's PREDECESSOR
 * neighborhood was "largely demolished for it" — the closure verb has a different subject).
 * Exported for the publish-time status linter so the gate and the deriver cannot drift.
 */
export const TERMINAL_CLOSURE_RE =
  /\b(closed (in|by) ((the |early |mid-|late )?([a-z]+ )?\d{4}s?)|closing in \d{4}|closed its doors|operated until|in operation until|until (it|the \w+) closed|ceased operations?\b|was demolished|demolished (in|by) \d{4}|torn down( in \d{4})?|no longer (exists|stands|operates))\b/i;

const REOPENED_RE = /\breopened\b/i;
const REPEALED_RE = /\b(repealed|struck down|overturned|ruled unconstitutional|enjoined)\b/i;
const AMENDED_RE = /\b(amended|superseded in part)\b/i;
const DECEASED_RE =
  /\b(died|death|deceased|passed away|killed|assassinated|d\.\s*\d{4}|death date|hanged|executed|murdered|martyred|slain|posthumous(ly)?|buried at|laid to rest)\b/i;

/**
 * Lynching verb forms only — bare "Lynch" surnames must not match.
 * Prefer "was lynched" / "lynched on|in|by" / "lynching of" over bare "lynching".
 */
const LYNCHING_DECEASED_RE = /\b(was\s+lynched|lynched\s+(on|in|by)|lynching\s+of)\b/i;

/** Parenthetical life range, e.g. "(1885–1952)" — end year signals deceased when it's not recent. */
const LIFE_RANGE_RE = /\((1[6-9]\d{2})\s*[–—-]\s*(1[6-9]\d{2}|20[0-2]\d)\)/;
function isDeceasedByLifeRange(text: string): boolean {
  const match = LIFE_RANGE_RE.exec(text);
  if (!match?.[2]) return false;
  return Number(match[2]) <= new Date().getFullYear() - 2;
}

function earliestYear(entry: CatalogStatusSource): string | undefined {
  const years: string[] = [];
  for (const era of entry.eraBuckets ?? []) {
    const m = /(\d{4})/.exec(era);
    if (m?.[1]) years.push(m[1]);
  }
  for (const claim of entry.claims ?? []) {
    const blob = `${claim.predicate ?? ''} ${claim.object ?? ''}`;
    const m = /\b(1[7-9]\d{2}|20\d{2})\b/.exec(blob);
    if (m?.[1]) years.push(m[1]);
  }
  const summary = `${entry.summary ?? ''} ${entry.historicalContext ?? ''}`;
  for (const m of summary.matchAll(/\b(1[7-9]\d{2}|20\d{2})\b/g)) {
    if (m[1]) years.push(m[1]);
  }
  years.sort();
  return years[0];
}

/**
 * Claims a reader could check this status against — real claim ids only.
 *
 * This used to synthesize `${entry.id}_claim_${i}` for any claim arriving without an id, which
 * produced references to nothing: claims are minted as `claim_<entityId>_<nn>`, so the invented
 * ids matched no claim on the record. Measured on release rel_20260723_authority_net_001, 3,270
 * published records cite a basis that resolves to no claim at all — the audit trail from a status
 * back to its evidence was decorative. An unciteable claim is dropped instead; a status with an
 * empty basis is honestly unsupported, which is the signal callers need.
 */
function basisClaimIds(entry: CatalogStatusSource): readonly string[] {
  const ids = (entry.claims ?? [])
    .map((claim) => claim.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return ids.slice(0, 4);
}

/**
 * True when the record has not been researched past the listing that created it.
 *
 * This is the same test the entity page's `isThinRecord` applies: single-source coverage with no
 * narrative context means what you are reading is the registry row itself. Such a record cannot
 * support a claim about present standing — its whole content is "X was listed on DATE for its
 * significance in Y", which is evidence of a listing, not of a building.
 *
 * Claim classification cannot stand in for this. A listing stub's second claim is
 * `significant_for: architecture, Black heritage`, which `isDesignationClaim` correctly declines
 * to call a designation, and the prose cannot be read either: the NRHP template asserts present
 * existence grammatically — "St. Paul AME Zion Church IS a building in Johnson City" — with
 * nothing behind it. Provenance is the only honest discriminator.
 */
function isUnresearchedRecord(entry: CatalogStatusSource): boolean {
  return entry.researchCoverage === 'minimal' && (entry.historicalContext ?? '').trim() === '';
}

/**
 * Place-like standing. `undefined` when the record supports no answer either way.
 *
 * This used to end in a bare `return 'active'`, reached by anything whose text mentioned a
 * church, school, park, district or town, and by everything else that fell through. That made
 * "still operates today" the catalog's single largest assertion and its least evidenced: a
 * building listed in 2001 may have burned down in 2009, and a registry stub says nothing either
 * way.
 *
 * The default survives for records that have actually been researched, where curated prose makes
 * it a reasonable reading. It does not survive for unresearched listings, which are exactly the
 * population that made the old default wrong at scale — 2,063 of them on that release. Dropping
 * the cue-free default outright was measured first and rejected: it also stripped `active` from
 * 564 curated records including the DuSable Museum and Ebenezer Baptist Church, because ACTIVE_RE
 * does not match plain present tense like "is a museum operated by the Oakland Public Library".
 */
function derivePlaceLike(entry: CatalogStatusSource): PlaceLikeStatus | undefined {
  const text = `${entry.summary ?? ''} ${entry.historicalContext ?? ''} ${entry.displayName ?? ''}`;
  if (TERMINAL_CLOSURE_RE.test(text) && !REOPENED_RE.test(text)) return 'historic';
  if (HISTORIC_RE.test(text) && !ACTIVE_RE.test(text)) return 'historic';
  if (ACTIVE_RE.test(text)) return 'active';
  if (/\b(movement|league|association|union|federation)\b/i.test(text) && HISTORIC_RE.test(text)) {
    return 'historic';
  }
  if (isUnresearchedRecord(entry)) return undefined;
  return 'active';
}

function deriveLaw(entry: CatalogStatusSource): LawStatus {
  const text = `${entry.summary ?? ''} ${entry.historicalContext ?? ''}`;
  if (/\benjoined\b/i.test(text)) return 'enjoined';
  if (/\bstruck down\b|\bruled unconstitutional\b/i.test(text)) return 'struck_down';
  if (REPEALED_RE.test(text)) return 'repealed';
  if (AMENDED_RE.test(text)) return 'amended';
  return 'in_force';
}

function deriveMovement(entry: CatalogStatusSource): MovementStatus {
  const text = `${entry.summary ?? ''} ${entry.historicalContext ?? ''}`;
  if (HISTORIC_RE.test(text) || /\b(ended|concluded|dissolved|merged into)\b/i.test(text)) {
    return 'historic';
  }
  return 'active';
}

function derivePersonLiving(entry: CatalogStatusSource): LivingStatus {
  if (entry.livingStatus) return entry.livingStatus;
  const text = `${entry.summary ?? ''} ${entry.historicalContext ?? ''}`;
  if (DECEASED_RE.test(text) || LYNCHING_DECEASED_RE.test(text) || isDeceasedByLifeRange(text)) {
    return 'deceased';
  }
  return 'unknown';
}

/**
 * If the entry already has statusHistory (or person livingStatus), pass through.
 * Otherwise derive a single open-ended history entry (or livingStatus for persons).
 * Returns `{}` for events (intentionally statusless).
 */
export function deriveCatalogEntityStatus(entry: CatalogStatusSource): DerivedCatalogStatus {
  if (entry.kind === 'event') {
    return {};
  }

  if (entry.kind === 'person') {
    const livingStatus = derivePersonLiving(entry);
    // Display status is honest about what we don't know — 'unknown' must NOT collapse to
    // 'living'. This is distinct from personStatusFromLiving in entity-status.ts, which governs
    // privacy/redaction and intentionally treats 'unknown' as living for that separate purpose.
    const status =
      livingStatus === 'deceased'
        ? 'deceased'
        : livingStatus === 'presumed_deceased'
          ? 'presumed_deceased'
          : livingStatus === 'unknown'
            ? 'unknown'
            : 'living';
    return { livingStatus, status };
  }

  if (entry.statusHistory && entry.statusHistory.length > 0) {
    const open = entry.statusHistory.find((e) => e.validTo === undefined || e.validTo === null);
    return {
      statusHistory: entry.statusHistory,
      ...(open
        ? { status: open.status }
        : entry.status
          ? { status: entry.status as EntityStatusValue }
          : {}),
    };
  }

  const validFrom = earliestYear(entry);
  const basis = basisClaimIds(entry);
  let status: EntityStatusValue | undefined;

  if ((PLACE_LIKE_STATUS_KINDS as readonly string[]).includes(entry.kind)) {
    status = derivePlaceLike(entry);
  } else if (entry.kind === 'law' || entry.kind === 'case') {
    // Cases use law vocabulary for "in force / struck down" style badges when projected.
    status = deriveLaw(entry);
  } else if (entry.kind === 'movement') {
    status = deriveMovement(entry);
  } else {
    // publication / artifact / other — treat as place-like active/historic
    status = derivePlaceLike(entry);
  }

  // No cue either way. Report `unknown` and write no lifecycle span: a statusHistory entry is a
  // dated assertion that the record cannot make, and callers already drop `unknown` rather than
  // rendering it as a finding.
  if (status === undefined) {
    return { status: 'unknown' };
  }

  const history: StatusHistoryEntry<EntityStatusValue> = {
    status,
    datePrecision: validFrom ? 'year' : 'circa',
    basisClaimIds: basis,
    ...(validFrom ? { validFrom } : { validFrom: 'undated' }),
  };

  return { statusHistory: [history], status };
}
