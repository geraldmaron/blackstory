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
};

export type DerivedCatalogStatus = {
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  /** Derived current status label for public projections. */
  readonly status?: EntityStatusValue | 'living' | 'deceased';
  readonly livingStatus?: LivingStatus;
};

const HISTORIC_RE =
  /\b(former|defunct|demolished|abandoned|ruins?|destroyed|closed in|ceased|no longer|was (a|an|the)|historic site|archaeological)\b/i;
const ACTIVE_RE =
  /\b(still (operates|operating|stands|serves|open)|remains (a|an|in)|continues to|currently|today\b|present[- ]day|active (congregation|campus|museum|university|school|church))\b/i;
const REPEALED_RE = /\b(repealed|struck down|overturned|ruled unconstitutional|enjoined)\b/i;
const AMENDED_RE = /\b(amended|superseded in part)\b/i;
const DECEASED_RE =
  /\b(died|death|deceased|passed away|killed|assassinated|d\.\s*\d{4}|death date)\b/i;

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

function basisClaimIds(entry: CatalogStatusSource): readonly string[] {
  const ids = (entry.claims ?? []).map((c, i) => c.id ?? `${entry.id}_claim_${i}`).filter(Boolean);
  return ids.slice(0, 4);
}

function derivePlaceLike(entry: CatalogStatusSource): PlaceLikeStatus {
  const text = `${entry.summary ?? ''} ${entry.historicalContext ?? ''} ${entry.displayName ?? ''}`;
  if (HISTORIC_RE.test(text) && !ACTIVE_RE.test(text)) return 'historic';
  if (ACTIVE_RE.test(text)) return 'active';
  // Districts, museums, universities, churches, towns default active unless historic cues
  if (
    /\b(university|college|museum|church|cathedral|mosque|synagogue|library|park|district|town|city|school)\b/i.test(
      text,
    )
  ) {
    return 'active';
  }
  if (/\b(movement|league|association|union|federation)\b/i.test(text) && HISTORIC_RE.test(text)) {
    return 'historic';
  }
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
  if (DECEASED_RE.test(text)) return 'deceased';
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
    const status = livingStatus === 'deceased' ? 'deceased' : 'living';
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
  let status: EntityStatusValue;

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

  const history: StatusHistoryEntry<EntityStatusValue> = {
    status,
    datePrecision: validFrom ? 'year' : 'circa',
    basisClaimIds: basis,
    ...(validFrom ? { validFrom } : { validFrom: 'undated' }),
  };

  return { statusHistory: [history], status };
}
