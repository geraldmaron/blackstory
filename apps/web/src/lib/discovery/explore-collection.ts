/** Collection predicates use Records facts; the camera only projects the result. */
import { EMPTY_RECORDS_QUERY, type RecordsQuery } from '../records/records-query';
import { matchesExcept, comparatorFor, type CollectionFacts } from '../records/records-matching';
import type { ExploreViewState } from '../map-experience/url-state';
import type { ExploreMapFeature } from '../map-experience/build-explore-map-source';
import { documentedDecades, normalizePeriod } from './collection-period';
import { parseCollectionToken } from './story-collection';

export function recordsQueryFromExplore(state: ExploreViewState): RecordsQuery {
  const value = (input: string) => (input === 'all' ? '' : input);
  const period = normalizePeriod({
    start: state.periodStart,
    end: state.periodEnd,
    includeUndated: state.includeUndated,
  });
  return {
    ...EMPTY_RECORDS_QUERY,
    q: state.query ?? '',
    sort: state.sort ?? 'discovery',
    kind: value(state.filters.kind),
    era: value(state.filters.era),
    topic: value(state.filters.theme),
    status: value(state.filters.status),
    state: state.state ?? '',
    evidence: state.floor ?? '',
    collection: parseCollectionToken(state.collection),
    periodStart: period.start,
    periodEnd: period.end,
    includeUndated: period.includeUndated,
    // Return context only: it never changes which records match, but Records restores it.
    layout: state.layout === 'chronology' ? 'chronology' : 'index',
  };
}

/**
 * `members` is the resolved id set of `state.collection`. A named collection without one (unknown
 * story, unavailable read, malformed token) matches nothing: the map must say membership is
 * unavailable rather than count zero or widen to the archive.
 */
export function matchExploreCollection(
  facts: readonly CollectionFacts[],
  state: ExploreViewState,
  members?: ReadonlySet<string>,
): readonly CollectionFacts[] {
  const query = recordsQueryFromExplore(state);
  return facts
    .filter(
      (fact) =>
        matchesExcept(fact, query, 'none', members) &&
        (state.filters.tone === 'all' || fact.row.mapTone === state.filters.tone) &&
        (state.filters.confidence === 'all' || fact.confidenceTier === state.filters.confidence),
    )
    .sort(comparatorFor(query.sort));
}

/**
 * Documented decades in the collection with the period lifted, for the period selects. Only
 * decades that hold records appear, so a sparse collection stays sparse.
 */
export function periodDecadesFor(
  facts: readonly CollectionFacts[],
  state: ExploreViewState,
  members?: ReadonlySet<string>,
): readonly { readonly decade: number; readonly count: number }[] {
  const query = recordsQueryFromExplore(state);
  const counts = new Map<number, number>();
  for (const fact of facts) {
    if (query.collection && members?.has(fact.row.id) !== true) continue;
    for (const decade of documentedDecades(fact.eraBuckets)) {
      counts.set(decade, (counts.get(decade) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade - b.decade);
}

export function drawableCollection(
  features: readonly ExploreMapFeature[],
  matches: readonly CollectionFacts[],
): readonly ExploreMapFeature[] {
  const byId = new Map(features.map((feature) => [feature.properties.entityId, feature]));
  return matches.flatMap((match) => {
    if (!match.mappable) return [];
    const feature = byId.get(match.row.id);
    return feature ? [feature] : [];
  });
}
