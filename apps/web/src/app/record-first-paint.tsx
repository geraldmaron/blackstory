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
  recordsQueryFromDiscovery,
} from '../lib/discovery/discovery-state';
import { isResolvablePlaceSlug } from '../lib/place/place-slug';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { getPublicSearchIndex } from '../lib/public-data/source';
import {
  findRecordsNeighbors,
  searchIndexReadyForRecords,
} from '../lib/records/build-records-index';

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
  return {
    title: model.lead.displayName,
    description: model.lead.summary,
  };
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
    permanentRedirect(`/${owner}/${slug}`);
  }

  const arrival = discoveryFromSearchParams(searchParams);
  const geo = model.lead.geoAnchor ?? geoAnchorFor(model.lead.id);

  let neighbors:
    | {
        readonly previous?: { readonly href: string; readonly name: string };
        readonly next?: { readonly href: string; readonly name: string };
        readonly index: number;
        readonly total: number;
      }
    | undefined;
  if (arrival.view === 'list') {
    const { data: searchDocs } = await getPublicSearchIndex();
    const catalog = searchIndexReadyForRecords(searchDocs)
      ? searchDocs
      : (await getSharedPublicEntities()).data;
    const found = findRecordsNeighbors(
      catalog,
      recordsQueryFromDiscovery(arrival),
      model.lead.id,
      placeArrivalQuery(arrival, 'list'),
    );
    if (found) {
      neighbors = {
        ...(found.previous
          ? { previous: { href: found.previous.href, name: found.previous.name } }
          : {}),
        ...(found.next ? { next: { href: found.next.href, name: found.next.name } } : {}),
        index: found.index,
        total: found.total,
      };
    }
  }

  const discovery = placeDiscoveryReturn(
    model.lead.id,
    arrival,
    geo ? { lat: geo.lat, lng: geo.lng } : undefined,
    neighbors,
  );
  return <HomeFirstPaint model={model} discovery={discovery} />;
}
