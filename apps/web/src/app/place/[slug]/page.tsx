/**
 * A published place at a public slug. Walked into from the map. The title is
 * the place. Back is BlackStory at `/`. Never `/entity/ent_…`.
 * Arrival query params may carry DiscoveryState for map/list return and list prev/next.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeFirstPaint } from '../../HomeFirstPaint';
import { loadHomeFirstPaint } from '../../home-first-paint';
import {
  discoveryFromSearchParams,
  placeArrivalQuery,
  placeDiscoveryReturn,
  recordsQueryFromDiscovery,
} from '../../../lib/discovery/discovery-state';
import { isResolvablePlaceSlug } from '../../../lib/place/place-slug';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { getSharedPublicEntities } from '../../../lib/map-experience/shared-map-data';
import { findRecordsNeighbors } from '../../../lib/records/build-records-index';

export const dynamic = 'force-dynamic';

type PlacePageProps = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isResolvablePlaceSlug(slug)) {
    return { title: 'Place not found' };
  }
  const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
  if (!model.lead) {
    return { title: 'Place not found' };
  }
  return {
    title: model.lead.displayName,
    description: model.lead.summary,
  };
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { slug } = await params;
  if (!isResolvablePlaceSlug(slug)) {
    notFound();
  }
  const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
  if (!model.lead) {
    notFound();
  }
  const arrival = discoveryFromSearchParams(await searchParams);
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
    const { data: entities } = await getSharedPublicEntities();
    const found = findRecordsNeighbors(
      entities,
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
