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
import { absolutePublicUrl } from '../../../lib/seo/metadata-builders';
import {
  buildRecordJsonLd,
  recordCanonicalPath,
  serializeJsonLd,
} from '../../../lib/seo/record-json-ld';
import { loadPlaceRecord } from '../place-record';
import { publicPlaceSlug } from '../../../lib/place/public-place-path';
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
  // The canonical is the record's own family address with no arrival query. A record page is
  // reachable under many arrival variants (map and list returns, prev/next), and without a
  // canonical each one reads to a crawler as a separate thin page.
  return {
    title: place.displayName,
    description: place.summary,
    alternates: {
      canonical: absolutePublicUrl(recordCanonicalPath(familyForKind(place.kind), slug)),
    },
  };
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { slug } = await params;
  const rawArrival = await searchParams;
  const place = await loadPlaceRecord(slug);
  if (!place) notFound();
  // Reached by a former name (an alias): `/entity/{id}` decides the record's current address.
  if (!slug.includes('--') && publicPlaceSlug(place.displayName) !== slug.trim()) {
    permanentRedirect(
      withQuery(`/entity/${encodeURIComponent(place.id)}`, recordArrivalQuery(rawArrival)),
    );
  }
  if (familyForKind(place.kind) !== 'place') {
    permanentRedirect(withQuery(`/invention/${slug}`, recordArrivalQuery(rawArrival)));
  }
  const jsonLd = buildRecordJsonLd({
    family: 'place',
    slug,
    displayName: place.displayName,
    summary: place.summary,
    jurisdictionLabel: place.jurisdictionLabel,
  });
  // No nonce: a JSON-LD block is data, never executed, so script-src does not govern it.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {await EntityRecordPage({
        entity: place,
        arrival: discoveryFromSearchParams(rawArrival),
        canonicalPath: recordCanonicalPath('place', slug),
      })}
    </>
  );
}
