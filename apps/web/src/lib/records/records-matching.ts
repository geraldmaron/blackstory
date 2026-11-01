/** Shared authoritative Records matching and order, safe for the Explore client. */
import type { RecordsRow } from './build-records-index';
import type { RecordsQuery, RecordsFilterKey, RecordsSort } from './records-query';
import type { ConfidenceTier } from '../map-experience/build-explore-map-source';
import { kindMatchesPublicFilter } from '../map-experience/filters';
import { meetsEvidenceFloor, type EvidenceFloor } from '../map-experience/evidence-grade';
import { isInternalRecordLabel } from '../place/public-place-path';
import { matchesPeriod } from '../discovery/collection-period';
import { COLLECTION_INVALID, COLLECTION_MISSING } from '../discovery/story-collection';

export type RecordFacts = {
  readonly row: RecordsRow;
  readonly eraBuckets: readonly string[];
  readonly topicIds: readonly string[];
  readonly confidenceTier: ConfidenceTier;
  readonly statePostal: string | undefined;
  readonly stateName: string | undefined;
  readonly status: string;
  readonly haystack: string;
  readonly mappable: boolean;
};

/** Only the fields needed for collection membership and bibliography order cross the wire. */
export type CollectionFacts = Omit<RecordFacts, 'row' | 'stateName'> & {
  readonly row: Pick<RecordsRow, 'id' | 'name' | 'kind' | 'mapTone'>;
};

/**
 * `members` is the resolved id set of a named collection (`query.collection`). A named collection
 * with no resolved set (`undefined`: unknown story, failed read, malformed token) matches nothing.
 * It must never fall through to the whole archive, nor read as a story with zero members.
 */
export function matchesExcept(
  facts: CollectionFacts,
  query: RecordsQuery,
  skip: RecordsFilterKey | 'period' | 'none',
  members?: ReadonlySet<string>,
): boolean {
  if (query.collection.length > 0) {
    // The finite sentinels are errors, not sets: they match nothing even if a caller hands over
    // members.
    if (query.collection === COLLECTION_INVALID || query.collection === COLLECTION_MISSING) {
      return false;
    }
    if (members === undefined || !members.has(facts.row.id)) return false;
  }
  if (
    skip !== 'period' &&
    !matchesPeriod(facts.eraBuckets, {
      start: query.periodStart,
      end: query.periodEnd,
      includeUndated: query.includeUndated,
    })
  ) {
    return false;
  }
  if (query.q.length > 0 && !facts.haystack.includes(query.q.toLowerCase())) return false;
  if (
    skip !== 'kind' &&
    query.kind.length > 0 &&
    !kindMatchesPublicFilter(facts.row.kind, query.kind)
  )
    return false;
  if (skip !== 'era' && query.era.length > 0 && !facts.eraBuckets.includes(query.era)) return false;
  if (skip !== 'state' && query.state.length > 0 && facts.statePostal !== query.state) return false;
  if (skip !== 'topic' && query.topic.length > 0 && !facts.topicIds.includes(query.topic))
    return false;
  if (skip !== 'status' && query.status.length > 0 && facts.status !== query.status) return false;
  // A floor, not an equality match. Routing "B and up" through an exact match would drop every
  // grade A record — the opposite of what the reader asked for (see `applyEvidenceFloor`).
  if (
    skip !== 'evidence' &&
    query.evidence.length > 0 &&
    !meetsEvidenceFloor(facts.confidenceTier, query.evidence as EvidenceFloor)
  )
    return false;
  return true;
}

/** Sequenced discovery: authored, graded, dated records before opaque site codes and undated rows. */
const TIER_RANK: Readonly<Record<string, number>> = {
  high: 0,
  medium: 1,
  low: 2,
  unrated: 3,
};

function earliestEraYear(facts: CollectionFacts): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const bucket of facts.eraBuckets) {
    const year = Number.parseInt(bucket, 10);
    if (Number.isFinite(year) && year < earliest) earliest = year;
  }
  return earliest;
}

/**
 * The orderings behind the sort control. Every one of them puts internal-looking labels last
 * and falls back to the record name, so a sort never produces an unstable order for rows that
 * tie on the key being sorted.
 */
function internalLast(a: CollectionFacts, b: CollectionFacts): number {
  const internalA = isInternalRecordLabel(a.row.name) ? 1 : 0;
  const internalB = isInternalRecordLabel(b.row.name) ? 1 : 0;
  return internalA - internalB;
}

export function comparatorFor(
  sort: RecordsSort,
): (a: CollectionFacts, b: CollectionFacts) => number {
  if (sort === 'discovery') return compareDiscoveryOrder;
  return (a, b) => {
    const internal = internalLast(a, b);
    if (internal !== 0) return internal;
    if (sort === 'name') return a.row.name.localeCompare(b.row.name);
    if (sort === 'era') {
      const eraA = earliestEraYear(a);
      const eraB = earliestEraYear(b);
      if (eraA !== eraB) return eraA - eraB;
      return a.row.name.localeCompare(b.row.name);
    }
    const tierA = TIER_RANK[a.confidenceTier] ?? 3;
    const tierB = TIER_RANK[b.confidenceTier] ?? 3;
    if (tierA !== tierB) return tierA - tierB;
    return a.row.name.localeCompare(b.row.name);
  };
}

function compareDiscoveryOrder(a: CollectionFacts, b: CollectionFacts): number {
  const internalA = isInternalRecordLabel(a.row.name) ? 1 : 0;
  const internalB = isInternalRecordLabel(b.row.name) ? 1 : 0;
  if (internalA !== internalB) return internalA - internalB;
  const tierA = TIER_RANK[a.confidenceTier] ?? 3;
  const tierB = TIER_RANK[b.confidenceTier] ?? 3;
  if (tierA !== tierB) return tierA - tierB;
  const eraA = earliestEraYear(a);
  const eraB = earliestEraYear(b);
  if (eraA !== eraB) return eraA - eraB;
  return a.row.name.localeCompare(b.row.name);
}
