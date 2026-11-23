/**
 * The Archive's list and timeline: the crawlable, non-spatial index. A map answers "what
 * happened near here" well and "what is documented about X" badly, so the archive's bare address
 * is the list. It must never 404 and must render something honest for any param combination a
 * stale bookmark carries.
 *
 * From 64rem the list is a left sheet and the persistent plate shows this page's rows as lights
 * beside it (`IndexCountry`). Narrower, or with no plate, it is a document.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { parseRecordsQuery, recordsHref } from '../../lib/records/build-records-index';
import { legacyRecordsHref } from '../../lib/records/records-query';
import { ARCHIVE_REDIRECTS_ENABLED } from '../../lib/redirects/archive-redirects.mjs';
import { RecordsIndexRoom } from '../records/RecordsIndex';
import { SeedInAddress } from '../records/SeedInAddress';
import { loadRecordsIndex, recordsQueryCacheKey } from '../records/load-records-index';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { buildEntityPhotoIndex } from '../../lib/map-experience/entity-photo-index';
import { exploreMapSourceFor } from '../../lib/map-experience/build-explore-map-source';
import { IndexCountry } from '../../components/map-stage/IndexCountry';
import '../country.css';
import '../reading-room.css';
import '../records/records-index.css';

export type ArchiveParams = Record<string, string | string[] | undefined>;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';

/** One shuffle seed per request, shared by the metadata and the page. */
const requestSeed = cache(() => Math.random().toString(36).slice(2, 8) || '0');

/**
 * The default browse order is a shuffle: a visit without a seed draws one, and the page's own
 * links carry it so paging continues the same order.
 */
function seededParams(params: ArchiveParams): ArchiveParams {
  const query = parseRecordsQuery(params);
  return query.sort === 'discovery' && query.q.length === 0 && query.seed.length === 0
    ? { ...params, seed: requestSeed() }
    : params;
}

/**
 * The canonical is self-referential and carries the narrowing, because a filtered page is a
 * distinct, useful set. `prev`/`next` are emitted as real link relations alongside the anchors
 * in the body. With the 4b redirects switched off, the canonical is the same set at its 4a
 * address (`/records`), so the old family is the one search engines are told to keep.
 */
export async function listMetadata(params: ArchiveParams): Promise<Metadata> {
  const { model, query } = await loadRecordsIndex(recordsQueryCacheKey(seededParams(params)));
  const absolute = (path: string): string => new URL(path, SITE_URL).toString();
  const canonical = absolute(
    ARCHIVE_REDIRECTS_ENABLED
      ? model.canonicalPath
      : legacyRecordsHref({ ...query, page: model.page, seed: '', selected: '', place: '' }),
  );
  // An unresolved collection or unreadable range is an explicit error state, never indexable.
  if (model.notice !== undefined) {
    return {
      title: 'Archive',
      robots: { index: false, follow: false },
      alternates: { canonical },
    };
  }

  const title =
    model.constraints.length > 0
      ? `Archive · ${model.constraints.map((constraint) => constraint.label).join(' · ')}`
      : 'Archive';

  return {
    title,
    description:
      'Every record in the active release as a browsable list: kind, place, era and evidence grade, filterable and linkable without opening the map.',
    alternates: { canonical },
    // Multi-facet and free-text narrowings are a crawl trap; see recordsQueryIndexable.
    ...(model.indexable ? {} : { robots: { index: false, follow: false } }),
  };
}

export async function ListView({ params }: { readonly params: ArchiveParams }) {
  const key = recordsQueryCacheKey(seededParams(params));
  const { model, query, collection } = await loadRecordsIndex(key);

  // A well-formed reference to a story the release does not have redirects TEMPORARILY (307)
  // to the finite `missing` sentinel: the story may publish later, so this is not a permanent
  // move, and every other narrowing rides along. It never drops into the bare archive.
  if (collection.state === 'unknown') {
    redirect(recordsHref({ ...query, collection: 'missing', page: 1 }));
  }

  // Thumbnails for the rows on this page only: the record's rights-cleared image, by record id.
  const { data: entities } = await getSharedPublicEntities();
  const photoIndex = buildEntityPhotoIndex(entities);
  const pageRows = [
    ...model.rows,
    ...(model.chronology?.sections.flatMap((section) => section.rows) ?? []),
  ];
  const photos: Record<string, string> = {};
  for (const row of pageRows) {
    const photo = photoIndex[row.id];
    if (photo) photos[row.id] = photo.url;
  }

  // The rows on this page that have a public point are the lights beside the list.
  const listed = new Set(pageRows.map((row) => row.id));
  const lights = exploreMapSourceFor(entities).featureCollection.features.filter((feature) =>
    listed.has(feature.properties.entityId),
  );

  return (
    <>
      {/*
        Emitted here rather than through `alternates` because Next's metadata API has no first
        class rel=prev/next, and a paged index without them teaches a crawler that page 2 is an
        unrelated document.
      */}
      {model.previousHref === undefined ? null : (
        <link rel="prev" href={new URL(model.previousHref, SITE_URL).toString()} />
      )}
      {model.nextHref === undefined ? null : (
        <link rel="next" href={new URL(model.nextHref, SITE_URL).toString()} />
      )}
      {query.seed.length > 0 ? <SeedInAddress seed={query.seed} /> : null}
      <RecordsIndexRoom
        model={model}
        photos={photos}
        // The timeline lays its decades out across the full window, so it stays a document. So
        // does a page with nothing to light: an empty map beside a list says nothing.
        {...(model.chronology === undefined && lights.length > 0
          ? { world: <IndexCountry lights={lights} listed={listed.size} /> }
          : {})}
      />
    </>
  );
}
