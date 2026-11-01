/** Collection predicates use Records facts; the camera only projects the result. */
import { EMPTY_RECORDS_QUERY, type RecordsQuery } from '../records/records-query';
import { matchesExcept, comparatorFor, type CollectionFacts } from '../records/records-matching';
import type { ExploreViewState } from '../map-experience/url-state';
import type { ExploreMapFeature } from '../map-experience/build-explore-map-source';

export function recordsQueryFromExplore(state: ExploreViewState): RecordsQuery {
  const value = (input: string) => (input === 'all' ? '' : input);
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
  };
}

export function matchExploreCollection(
  facts: readonly CollectionFacts[],
  state: ExploreViewState,
): readonly CollectionFacts[] {
  const query = recordsQueryFromExplore(state);
  return facts
    .filter(
      (fact) =>
        matchesExcept(fact, query, 'none') &&
        (state.filters.tone === 'all' || fact.row.mapTone === state.filters.tone) &&
        (state.filters.confidence === 'all' || fact.confidenceTier === state.filters.confidence),
    )
    .sort(comparatorFor(query.sort));
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
