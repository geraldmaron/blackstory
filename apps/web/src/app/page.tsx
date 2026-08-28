/**
 * `/` is the public front door. First paint is one released place (or a small featured set),
 * not a 4,101-record filter board. Gerald's intent: a regular person can find what happened
 * here. The live Atlas used to be the boot; that painted "Loading 4,101 records…" on black
 * and pulled the catalog before anything else (also the pooler-cost leak).
 *
 * Atlas / filter board stays reachable after, not as the boot:
 * - `/?atlas=1` (CommandBar Atlas, `/explore` and `/map` 308 here)
 * - any surviving explore filter (`?state=`, `?kind=`, `?selected=`, …)
 *
 * Bare `/` uses `loadHomeFirstPaint` (thin ID read + optional lead story). It must not call
 * `getSharedPublicEntities` or mount `AtlasLoader` (those request the full catalog).
 *
 * `/explore` 308s here carrying its query, so a filter bookmark still opens the instrument.
 */
import type { Metadata } from 'next';
import { FilterBar } from '@repo/ui';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { SynchronizedResultList } from '../components/map-experience/SynchronizedResultList';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { wantsAtlasInstrument } from '../lib/nav/atlas-door';
import { AtlasLoader } from './explore/AtlasLoader';
import { buildAtlasShell } from './explore/explore-view-model';
import { HomeFirstPaint } from './HomeFirstPaint';
import { loadHomeFirstPaint } from './home-first-paint';
import '../components/patterns/browse-mode.css';
import '../components/patterns/edition-fact-icon.css';
import '../components/patterns/record-anatomy.css';
import './explore/explore.css';
import './explore/explore-edition.css';

/**
 * Dynamic because it reads `searchParams` (door vs Atlas), and because a build without a
 * database must not prerender a live featured place. Keep this page-scoped; do not hoist
 * force-dynamic to the root layout.
 */
export const dynamic = 'force-dynamic';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19). Filter permutations of the Atlas still collapse here.
 */
export const metadata: Metadata = {
  description:
    'History, pinned to place. Start with one documented record, then open the map when you want the archive.',
  alternates: { canonical: absolutePublicUrl('/') },
};

/** Rows in the `<noscript>` fallback list when the Atlas is requested. */
const NOSCRIPT_ROW_CAP = 20;

type HomePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  if (!wantsAtlasInstrument(params)) {
    const model = await loadHomeFirstPaint();
    return <HomeFirstPaint model={model} />;
  }

  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const { shell, noscriptFeatures } = buildAtlasShell(params, entities, dataSource);
  const view = { ...shell, filteredFeatures: noscriptFeatures };

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

      <AtlasLoader shell={shell} />
    </>
  );
}
