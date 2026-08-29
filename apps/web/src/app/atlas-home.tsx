/**
 * Atlas instrument for `/explore` (and `/map` → `/explore`).
 * First paint is the pin plate plus the live catalog shell. Kind / Tone / Era
 * belong here, not on `/`. Shop tokens stay off the first HTML document.
 */
import { FilterBar } from '@repo/ui';
import { SynchronizedResultList } from '../components/map-experience/SynchronizedResultList';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { toFirstPaintPins } from '../lib/map-experience/first-paint-pins';
import { AtlasLoader } from './explore/AtlasLoader';
import { buildAtlasShell } from './explore/explore-view-model';
import { FirstPaintPinPlate } from './first-paint-pin-plate';
import '../components/patterns/browse-mode.css';
import '../components/patterns/edition-fact-icon.css';
import '../components/patterns/record-anatomy.css';
import './explore/explore.css';
import './explore/explore-edition.css';

/** Rows in the `<noscript>` fallback list. The crawlable index is `/records`. */
const NOSCRIPT_ROW_CAP = 20;

type AtlasHomeProps = {
  readonly params: Record<string, string | string[] | undefined>;
};

export async function AtlasHome({ params }: AtlasHomeProps) {
  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const { shell, noscriptFeatures } = buildAtlasShell(params, entities, dataSource);
  const pins = toFirstPaintPins(noscriptFeatures);
  const view = { ...shell, filteredFeatures: noscriptFeatures };

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
            {view.totalMatched} documented record{view.totalMatched === 1 ? '' : 's'} matching
            filters · oldest first
          </p>
          <SynchronizedResultList
            features={view.filteredFeatures.slice(0, NOSCRIPT_ROW_CAP)}
            labelledBy="explore-results-heading-njs"
          />
          {view.filteredFeatures.length > NOSCRIPT_ROW_CAP ? (
            <p className="ds-sans ds-explore__results-count">
              Showing the first {NOSCRIPT_ROW_CAP} of {view.filteredFeatures.length}. Enable
              JavaScript for the full map and records list, or browse every record at{' '}
              <a href="/records">/records</a>.
            </p>
          ) : null}
        </div>
      </noscript>
      <FirstPaintPinPlate pins={pins} />
      <AtlasLoader shell={shell} pins={pins} />
    </>
  );
}
