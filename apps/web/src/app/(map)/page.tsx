/**
 * `/` is the Atlas: one full-viewport live plate with opaque panels floating over it, and the
 * canonical URL for the instrument (design-direction-v9-surfaces.md §4, §6). `/explore` 308s
 * here carrying its query, so this page and that redirect are one contract.
 *
 * The plate itself is mounted once by the root shell and persists across navigation; this page
 * only builds the view model and hands it to `AtlasExperience`, which sends the first
 * `patchData` — the call that builds the GL context on demand. Filters use native GET navigation
 * so the surface works without JavaScript; the client island adds the camera and cluster
 * drill-down. The camera stays in memory, so the shareable URL carries filters and selection but
 * never pan or zoom (ADR-017).
 */
import { FilterBar } from '@repo/ui';
import { SynchronizedResultList } from '../../components/map-experience/SynchronizedResultList';
import { getSharedPublicEntities } from './shared-map-data';
import { AtlasExperience } from './explore/AtlasExperience';
import { buildExploreViewModelAsync } from './explore/explore-view-model';
import { toSerializableExploreViewModel } from './explore/explore-view-model-wire';
import '../../components/patterns/browse-mode.css';
import '../../components/patterns/edition-fact-icon.css';
import '../../components/patterns/record-anatomy.css';
import './explore/explore.css';
import './explore/explore-edition.css';

/**
 * No `title`: the root layout's default is the product name, which is what `/` should read as.
 * A per-route title here would render "Explore · BlackStory" on the site's front door.
 */
export const metadata = {
  description:
    'Map-first national view of documented Black history: every geo-anchored record in the active release.',
};

type AtlasPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AtlasPage({ searchParams }: AtlasPageProps) {
  const params = await searchParams;
  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const view = await buildExploreViewModelAsync(params, entities, dataSource);

  return (
    <>
      <noscript>
        <div className="ds-explore__noscript ds-container ds-page">
          <FilterBar
            method="get"
            action="/"
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
            {view.totalMatched} documented record{view.totalMatched === 1 ? '' : 's'} matching
            filters · oldest first
          </p>
          {/* Cap the no-JS list so progressive-enhancement HTML stays small; the
              interactive client island owns the full synchronized peer. */}
          <SynchronizedResultList
            features={view.filteredFeatures.slice(0, 100)}
            labelledBy="explore-results-heading-njs"
          />
          {view.filteredFeatures.length > 100 ? (
            <p className="ds-sans ds-explore__results-count">
              Showing the first 100 of {view.filteredFeatures.length}. Enable JavaScript for the
              full map and records list.
            </p>
          ) : null}
        </div>
      </noscript>

      <AtlasExperience initial={toSerializableExploreViewModel(view)} />
    </>
  );
}
