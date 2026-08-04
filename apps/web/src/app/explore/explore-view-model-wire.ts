/**
 * Wire shape for the explore server -> client `initial` prop. `allFeatures` and
 * `filteredFeatures` are pure derivations of `source` + `viewState`; shipping them as props
 * duplicated ~4k feature references three times in the RSC Flight payload, which crashes
 * React's dev deserializer (`RangeError: Invalid array length`) once the catalog is large
 * enough. The client rebuilds them with `hydrateExploreViewModel`.
 *
 * Lives apart from `explore-view-model.ts` because that module (via the history graph seed)
 * reaches server-only imports (`node:crypto`); this one must stay importable from the client
 * island.
 */
import { applyExploreFilters } from '../../lib/map-experience';
import type { ExploreViewModel } from './explore-view-model';

export type SerializableExploreViewModel = Omit<
  ExploreViewModel,
  'allFeatures' | 'filteredFeatures'
>;

export function toSerializableExploreViewModel(
  view: ExploreViewModel,
): SerializableExploreViewModel {
  const { allFeatures: _allFeatures, filteredFeatures: _filteredFeatures, ...serializable } = view;
  return serializable;
}

/** Rebuilds the derived feature arrays on the client from the serialized view model. */
export function hydrateExploreViewModel(
  serialized: SerializableExploreViewModel,
): ExploreViewModel {
  const allFeatures = serialized.source.featureCollection.features;
  return {
    ...serialized,
    allFeatures,
    filteredFeatures: applyExploreFilters(
      allFeatures,
      serialized.viewState.filters,
      serialized.viewState.state,
    ),
  };
}
