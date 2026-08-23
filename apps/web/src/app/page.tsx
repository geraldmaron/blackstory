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
import type { Metadata } from 'next';
import { FilterBar } from '@repo/ui';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { SynchronizedResultList } from '../components/map-experience/SynchronizedResultList';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { AtlasLoader } from './explore/AtlasLoader';
import { buildAtlasShell } from './explore/explore-view-model';
import '../components/patterns/browse-mode.css';
import '../components/patterns/edition-fact-icon.css';
import '../components/patterns/record-anatomy.css';
import './explore/explore.css';
import './explore/explore-edition.css';

/**
 * Dynamic because it reads `searchParams` (the filters are GET navigation, so the page works with
 * JavaScript off), and because a build without a database — the CI gate — must not prerender
 * it. This export must stay page-scoped (it used to live on the now-deleted `(map)/layout.tsx`,
 * which force-dynamic'd this page and nothing else) — do not hoist it to the root layout, which
 * would force-dynamic every route in the app.
 *
 * Dynamic means every request is a function invocation with a no-store response, so what this
 * page renders has to be small. It is: the parsed view state and the facet/count derivations
 * (`AtlasShellModel`). The release-wide catalog — every feature, the history edge catalog — is
 * NOT rendered here; `AtlasLoader` fetches it from `/atlas/catalog`, which is CDN-cached. Before
 * that split (2026-08-22) this page put ~15 MB of RSC payload on every request and was, by
 * itself, the month's Vercel bill. Do not put the catalog back in the `initial` prop.
 */
export const dynamic = 'force-dynamic';

/**
 * No `title`: the root layout's default is the product name, which is what `/` should read as.
 * A per-route title here would render "Explore · BlackStory" on the site's front door.
 *
 * The canonical is the bare `/`, deliberately dropping any query (SP-19, repo-92n2.19). The
 * Atlas takes state, era, kind, topic and status as filters and `/explore` 308s here carrying all
 * of them, so the number of reachable URLs that render substantially the same page is the product
 * of every facet. Self-canonicalising each permutation would offer a crawler thousands of near
 * duplicates of the front door; collapsing them onto `/` offers one. `/records` is the surface
 * that self-canonicalises a narrowing, because there the narrowing IS the page.
 */
export const metadata: Metadata = {
  description:
    'Map-first national view of documented Black history: every geo-anchored record in the active release.',
  alternates: { canonical: absolutePublicUrl('/') },
};

type AtlasPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AtlasPage({ searchParams }: AtlasPageProps) {
  const params = await searchParams;
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

      <AtlasLoader shell={shell} />
    </>
  );
}
