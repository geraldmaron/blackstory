/**
 * `/records` — the crawlable, non-spatial record index.
 *
 * The epic's first binding correction: a map answers "what happened near here" well and "what is
 * documented about X" badly, so the archive keeps a browsable index at its own URL rather than
 * hiding one inside the homepage and canonicalising it away.
 *
 * This is also the landing surface for three URL families — `/search`, `/history` and `/facts`
 * all resolve here in one hop — so it must never 404 and must render something honest for any
 * param combination a stale bookmark carries.
 *
 * v11 Country: from 64rem the list is a left sheet and the persistent plate shows this page's
 * rows as lights beside it (`IndexCountry`). Narrower, or with no plate, it is the document it
 * always was. "Show these on the map" still hands the whole narrowing to Explore.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { parseRecordsQuery, recordsHref } from '../../lib/records/build-records-index';
import { RecordsIndexRoom } from './RecordsIndex';
import { SeedInAddress } from './SeedInAddress';
import { loadRecordsIndex, recordsQueryCacheKey } from './load-records-index';
import { getSharedPublicEntities } from '../../lib/map-experience/shared-map-data';
import { buildEntityPhotoIndex } from '../../lib/map-experience/entity-photo-index';
import { exploreMapSourceFor } from '../../lib/map-experience/build-explore-map-source';
import { IndexCountry } from '../../components/map-stage/IndexCountry';
import '../country.css';
import '../reading-room.css';
import './records-index.css';

type RecordsPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';

/** One shuffle seed per request, shared by the metadata and the page. */
const requestSeed = cache(() => Math.random().toString(36).slice(2, 8) || '0');

/**
 * The default browse order is a shuffle: a visit without a seed draws one, and the page's own
 * links carry it so paging continues the same order.
 */
async function seededParams(
  searchParams: RecordsPageProps['searchParams'],
): Promise<Record<string, string | string[] | undefined>> {
  const params = await searchParams;
  const query = parseRecordsQuery(params);
  return query.sort === 'discovery' && query.q.length === 0 && query.seed.length === 0
    ? { ...params, seed: requestSeed() }
    : params;
}

/**
 * The canonical is self-referential and carries the narrowing, because a filtered page is a
 * distinct, useful set — pointing every combination at bare `/records` is exactly the mistake
 * §4 names. `prev`/`next` are emitted as real link relations alongside the anchors in the body.
 */
export async function generateMetadata({ searchParams }: RecordsPageProps): Promise<Metadata> {
  const key = recordsQueryCacheKey(await seededParams(searchParams));
  const { model } = await loadRecordsIndex(key);
  const absolute = (path: string): string => new URL(path, SITE_URL).toString();
  // An unresolved collection or unreadable range is an explicit error state, never indexable.
  if (model.notice !== undefined) {
    return {
      title: 'Records',
      robots: { index: false, follow: false },
      alternates: { canonical: absolute(model.canonicalPath) },
    };
  }

  const title =
    model.constraints.length > 0
      ? `Records · ${model.constraints.map((constraint) => constraint.label).join(' · ')}`
      : 'Records';

  return {
    title,
    description:
      'Every record in the active release as a browsable list: kind, place, era and evidence grade, filterable and linkable without opening the map.',
    alternates: { canonical: absolute(model.canonicalPath) },
    // Multi-facet and free-text narrowings are a crawl trap; see recordsQueryIndexable.
    ...(model.indexable ? {} : { robots: { index: false, follow: false } }),
    other: {
      ...(model.previousHref !== undefined ? { 'link:prev': absolute(model.previousHref) } : {}),
      ...(model.nextHref !== undefined ? { 'link:next': absolute(model.nextHref) } : {}),
    },
  };
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const key = recordsQueryCacheKey(await seededParams(searchParams));
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

  // v11 Country: the rows on this page that have a public point are the lights beside the list.
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
        // The timeline lays its decades out across the full window, so it stays a document for
        // now. So does a page with nothing to light: an empty globe beside a list says nothing.
        {...(model.chronology === undefined && lights.length > 0
          ? { world: <IndexCountry lights={lights} listed={listed.size} /> }
          : {})}
      />
    </>
  );
}
