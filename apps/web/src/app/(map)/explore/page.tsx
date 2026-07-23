/**
 * Explore surface (): the shared `MapStage` canvas (mounted once by the `(map)` layout) is
 * the full-viewport base layer here too. This page fetches through `getSharedPublicEntities`
 * (memoized per-request, ADR-017 "one fetch per request, however many server components ask for
 * it") and renders `ExploreMapExperience`'s floating chrome — filters, results list, narrative
 * off-ramps, legend — over the persisted canvas. Filters use native GET navigation (no-JS safe);
 * the client island adds the interactive camera and cluster drill-down (camera stays
 * in-memory; shareable URL carries filters/selection, not pan/zoom).
 */
import { FilterBar } from '@repo/ui';
import { SynchronizedResultList } from '../../../components/map-experience/SynchronizedResultList';
import { getSharedPublicEntities } from '../shared-map-data';
import { ExploreMapExperience } from './ExploreMapExperience';
import { buildExploreViewModel } from './explore-view-model';
import '../../../components/patterns/browse-mode.css';
import '../../../components/patterns/edition-fact-icon.css';
import '../../../components/patterns/record-anatomy.css';
import './explore.css';
import './explore-edition.css';

export const metadata = {
  title: 'Explore',
  description:
    'Map-first national view of documented Black history: every geo-anchored record in the active release.',
};

type ExplorePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const view = buildExploreViewModel(params, entities, dataSource);

  return (
    <>
      <noscript>
        <div className="ds-explore__noscript ds-container ds-page">
          <FilterBar
            method="get"
            action="/explore"
            legend="Filter documented records"
            fields={[
              {
                id: 'explore-kind-njs',
                name: 'kind',
                label: 'Kind',
                type: 'select',
                defaultValue: view.viewState.filters.kind,
                options: view.facetOptions.kind,
              },
              {
                id: 'explore-tone-njs',
                name: 'tone',
                label: 'Tone',
                type: 'select',
                defaultValue: view.viewState.filters.tone,
                options: view.facetOptions.tone,
              },
              {
                id: 'explore-era-njs',
                name: 'era',
                label: 'Era',
                type: 'select',
                defaultValue: view.viewState.filters.era,
                options: view.facetOptions.era,
              },
              {
                id: 'explore-theme-njs',
                name: 'theme',
                label: 'Theme',
                type: 'select',
                defaultValue: view.viewState.filters.theme,
                options: view.facetOptions.theme,
              },
              {
                id: 'explore-status-njs',
                name: 'status',
                label: 'Status',
                type: 'select',
                defaultValue: view.viewState.filters.status,
                options: view.facetOptions.status,
              },
              {
                id: 'explore-confidence-njs',
                name: 'confidence',
                label: 'Confidence',
                type: 'select',
                defaultValue: view.viewState.filters.confidence,
                options: view.facetOptions.confidence,
              },
              {
                id: 'explore-state-njs',
                name: 'state',
                label: 'Where',
                type: 'select',
                defaultValue: view.viewState.state ?? 'all',
                options: view.facetOptions.state,
              },
            ]}
          />
          <p className="ds-sans ds-explore__results-count" id="explore-results-heading-njs">
            {view.totalMatched} documented record{view.totalMatched === 1 ? '' : 's'} in view
          </p>
          <SynchronizedResultList
            features={view.filteredFeatures}
            labelledBy="explore-results-heading-njs"
          />
        </div>
      </noscript>

      <ExploreMapExperience initial={view} />
    </>
  );
}
