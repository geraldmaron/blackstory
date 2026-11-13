/**
 * The first-paint record room, shared by `/place/{slug}` and `/invention/{slug}`.
 *
 * Both families resolve the same published name the same way and render the same room. What
 * differs is which family owns the record: a place stands somewhere, an invention does not.
 * Splitting the families without splitting this module keeps one behavior — arrival query
 * handling, list prev/next, discovery return — rather than two that drift.
 *
 * A record requested from the wrong family permanently redirects to its own, carrying the slug
 * through verbatim so a disambiguated `{slug}--{entityId}` address survives the move. The
 * target family is a pure function of the record's kind, so the redirect cannot loop.
 */
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { HomeFirstPaint } from './HomeFirstPaint';
import { loadHomeFirstPaint } from './home-first-paint';
import {
  discoveryFromSearchParams,
  placeArrivalQuery,
  placeDiscoveryReturn,
  recordArrivalQuery,
  recordsQueryFromDiscovery,
  withQuery,
  type DiscoveryState,
  type PlaceDiscoveryReturn,
} from '../lib/discovery/discovery-state';
import { isResolvablePlaceSlug } from '../lib/place/place-slug';
import { buildExploreMapSource } from '../lib/map-experience/build-explore-map-source';
import { findRecordsNeighbors } from '../lib/records/build-records-index';
import { resolveStoryCollectionSource } from '../lib/stories/source';
import {
  collectionMemberIds,
  resolveStoryCollection,
  storyCollectionSlug,
} from '../lib/discovery/story-collection';
import { loadRecordsCatalog } from '../lib/records/records-catalog';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { buildRecordJsonLd, recordCanonicalPath, serializeJsonLd } from '../lib/seo/record-json-ld';

/** The public families a released record can address. */
export type RecordFamily = 'place' | 'invention';

const NOT_FOUND_TITLE: Readonly<Record<RecordFamily, string>> = {
  place: 'Place not found',
  invention: 'Invention not found',
};

/** The family that owns a record of this kind. */
export function familyForKind(kind: string | undefined): RecordFamily {
  return kind === 'invention' ? 'invention' : 'place';
}

export type RecordFirstPaintProps = {
  readonly family: RecordFamily;
  readonly slug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
};

export async function recordFirstPaintMetadata(
  family: RecordFamily,
  slug: string,
): Promise<Metadata> {
  if (!isResolvablePlaceSlug(slug)) {
    return { title: NOT_FOUND_TITLE[family] };
  }
  const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
  if (!model.lead) {
    return { title: NOT_FOUND_TITLE[family] };
  }
  // The canonical is the record's own family address with no arrival query. A record page is
  // reachable under many DiscoveryState query variants (map and list returns, prev/next), and
  // without a canonical each one reads to a crawler as a separate thin page.
  return {
    title: model.lead.displayName,
    description: model.lead.summary,
    alternates: {
      canonical: absolutePublicUrl(recordCanonicalPath(familyForKind(model.lead.kind), slug)),
    },
  };
}

type ListNeighbors = Parameters<typeof placeDiscoveryReturn>[3];

/**
 * Previous/next within the list the reader came from, for any record family. Only a list origin
 * has an order to step through; a map or direct arrival yields nothing. Reads the one released
 * bibliography (`loadRecordsCatalog`), already cached per request.
 */
export async function loadRecordListNeighbors(
  arrival: DiscoveryState,
  entityId: string,
): Promise<ListNeighbors> {
  if (arrival.view !== 'list') return undefined;
  const { data: catalog } = await loadRecordsCatalog();
  const query = recordsQueryFromDiscovery(arrival);
  // A named collection steps through its own released members. When it cannot be resolved
  // (unknown story, failed read, malformed token) there is no list to step through; the arrival
  // never falls back to stepping through the whole archive.
  let members: ReadonlySet<string> | undefined;
  if (query.collection !== '') {
    const slug = storyCollectionSlug(query.collection);
    if (slug === undefined) return undefined;
    members = collectionMemberIds(
      resolveStoryCollection(
        await resolveStoryCollectionSource(slug),
        new Set((catalog as readonly { readonly id: string }[]).map((entry) => entry.id)),
      ),
    );
    if (members === undefined) return undefined;
  }
  const found = findRecordsNeighbors(
    catalog,
    query,
    entityId,
    placeArrivalQuery(arrival, 'list'),
    members,
  );
  if (!found) return undefined;
  return {
    ...(found.previous
      ? { previous: { href: found.previous.href, name: found.previous.name } }
      : {}),
    ...(found.next ? { next: { href: found.next.href, name: found.next.name } } : {}),
    index: found.index,
    total: found.total,
  };
}

/** Shared return builder so every family derives its map/list paths from the same arrival. */
export async function recordDiscoveryReturn(
  entityId: string,
  arrival: DiscoveryState,
  geo: { readonly lat: number; readonly lng: number } | undefined,
  mapped = true,
): Promise<PlaceDiscoveryReturn> {
  const neighbors = await loadRecordListNeighbors(arrival, entityId);
  return placeDiscoveryReturn(entityId, arrival, geo, neighbors, mapped);
}

export async function RecordFirstPaint({ family, slug, searchParams }: RecordFirstPaintProps) {
  if (!isResolvablePlaceSlug(slug)) {
    notFound();
  }
  const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
  if (!model.lead) {
    notFound();
  }

  const owner = familyForKind(model.lead.kind);
  if (owner !== family) {
    // Same status, same slug; only the normalized investigation context rides along.
    permanentRedirect(withQuery(`/${owner}/${slug}`, recordArrivalQuery(searchParams)));
  }

  const arrival = discoveryFromSearchParams(searchParams);
  const feature = buildExploreMapSource([model.lead]).featureCollection.features[0];
  const geo = feature
    ? { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
    : undefined;
  const discovery = await recordDiscoveryReturn(model.lead.id, arrival, geo, feature !== undefined);
  const jsonLd = buildRecordJsonLd({
    family,
    slug,
    displayName: model.lead.displayName,
    summary: model.lead.summary,
    jurisdictionLabel: model.lead.jurisdictionLabel,
  });
  // No nonce: a JSON-LD block is data, never executed, so script-src does not govern it, and a
  // server-only nonce would hydrate as a mismatch (same reasoning as the story page).
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomeFirstPaint model={model} discovery={discovery} />
    </>
  );
}
