/**
 * A published place at a public slug. It renders the one record page every family shares
 * (`EntityRecordPage`); arrival query params carry the map/list return and list prev/next.
 *
 * An invention that still holds an indexed place address permanently redirects to
 * `/invention/{slug}`, carrying the slug verbatim so a `{slug}--{entityId}` address survives.
 */
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { EntityRecordPage } from '../../entity/[id]/EntityRecordPage';
import { familyForKind } from '../../record-family';
import { loadPlaceRecord } from '../place-record';
import {
  discoveryFromSearchParams,
  recordArrivalQuery,
  withQuery,
} from '../../../lib/discovery/discovery-state';

export const dynamic = 'force-dynamic';

type PlacePageProps = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  const place = await loadPlaceRecord(slug);
  if (!place) return { title: 'Place not found' };
  return { title: place.displayName, description: place.summary };
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { slug } = await params;
  const rawArrival = await searchParams;
  const place = await loadPlaceRecord(slug);
  if (!place) notFound();
  if (familyForKind(place.kind) !== 'place') {
    permanentRedirect(withQuery(`/invention/${slug}`, recordArrivalQuery(rawArrival)));
  }
  return EntityRecordPage({ entity: place, arrival: discoveryFromSearchParams(rawArrival) });
}
