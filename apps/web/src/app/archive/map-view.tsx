/**
 * The Archive's map view: the working map with its list column, on the persistent plate. Any
 * filter on it is one reader's view of the same map, so only the bare view is indexable; the
 * camera is never in the address (archive-url-contract.md 10.1, 10.2).
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadDoorPinPlate } from '../../lib/map-experience/door-catalog';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { loadRecordsCatalog } from '../../lib/records/records-catalog';
import { buildExploreHref, parseExploreSearchParams } from '../../lib/map-experience/url-state';
import { resolveStoryCollectionSource } from '../../lib/stories/source';
import {
  NO_COLLECTION,
  collectionDescriptorWithoutRead,
  parseCollectionToken,
  resolveStoryCollection,
  storyCollectionSlug,
  type CollectionDescriptor,
} from '../../lib/discovery/story-collection';
import { recordsQueryFromExplore } from '../../lib/discovery/explore-collection';
import { recordsHref } from '../../lib/records/records-query';
import { ARCHIVE_REDIRECTS_ENABLED } from '../../lib/redirects/archive-redirects.mjs';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { buildAtlasShell } from '../explore/explore-view-model';
import { ArchiveMap } from './ArchiveMap';
import type { ArchiveParams } from './list-view';
import '../explore/explore.css';

/**
 * The bare map is indexable. Every other address is the same map narrowed, misses the edge
 * cache and renders in a function, so it says `noindex, nofollow` and names the bare map as
 * canonical. `view` alone is not a narrowing.
 */
export function mapMetadata(params: ArchiveParams): Metadata {
  const isQueryView = Object.keys(params).some((key) => key !== 'view');
  const metadata = buildStaticPageMetadata({
    path: ARCHIVE_REDIRECTS_ENABLED ? '/archive?view=map' : '/explore',
    title: 'Archive map',
    description: 'Every mapped record in the archive, on the map, with the list beside it.',
    ...(isQueryView ? { noIndex: true } : {}),
  });
  // The builder keeps `follow: true` on noindexed pages (SP-19). A query view is a crawl trap
  // rather than a dropped page, so it also says nofollow, like a list combination.
  return isQueryView ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}

export async function MapView({ params }: { readonly params: ArchiveParams }) {
  const [{ pins, features }, { data: entities, source: dataSource }, { data: collectionCatalog }] =
    await Promise.all([loadDoorPinPlate(), getSharedPublicEntities(), loadRecordsCatalog()]);

  // A named story collection reads the story cache; the unfiltered map never does, so an
  // unavailable story source cannot take the plain map down. Sentinels need no read.
  const viewState = parseExploreSearchParams(params);
  const token = parseCollectionToken(viewState.collection);
  const storySlug = storyCollectionSlug(token);
  const storySource =
    storySlug === undefined ? undefined : await resolveStoryCollectionSource(storySlug);
  const collection: CollectionDescriptor =
    storySource !== undefined
      ? resolveStoryCollection(
          storySource,
          new Set(
            (collectionCatalog as readonly { readonly id: string }[]).map((entry) => entry.id),
          ),
        )
      : (collectionDescriptorWithoutRead(token) ?? NO_COLLECTION);
  // A well-formed story the release does not have redirects TEMPORARILY (307) to the finite
  // `missing` sentinel, keeping every other narrowing. It never falls through to the bare map.
  if (collection.state === 'unknown') {
    redirect(buildExploreHref({ ...viewState, collection: 'missing' }));
  }

  const { shell } = buildAtlasShell(
    params,
    entities,
    dataSource,
    features,
    collectionCatalog,
    collection,
  );

  return (
    <main id="main" className="ds-archive-map">
      {/* Without script there is no map at all. The list is the same records and needs none. */}
      <noscript>
        <p className="ds-archive-map__noscript">
          The map needs JavaScript.{' '}
          <a href={recordsHref(recordsQueryFromExplore(shell.viewState))}>
            Read the same records as a list
          </a>
          .
        </p>
      </noscript>
      <ArchiveMap shell={shell} pins={pins} />
    </main>
  );
}
