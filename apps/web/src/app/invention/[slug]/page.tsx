/**
 * A published invention at a public slug.
 *
 * Its own family because an invention is a work, not a stand: Latimer's carbon-manufacturing
 * process happens at no coordinate a reader can walk to, and an invention needs no patent and no
 * address to exist. It rode `/place/{slug}` only because the stand test admits anything that is
 * not a living private person, which is a test for who may be named, not for what a place is.
 *
 * It renders the one record page every family shares. An invention is never a visit: its place
 * is where the work was documented, shown as the Where fact at its stored precision, with no
 * directions and no claim that the object still stands.
 *
 * A slug that resolves to anything other than an invention permanently redirects to `/place/`,
 * which is the mirror of the invention redirect the place page does.
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
import {
  discoveryFromSearchParams,
  recordArrivalQuery,
  withQuery,
} from '../../../lib/discovery/discovery-state';
import { loadInventionRecord } from '../invention-record';

export const dynamic = 'force-dynamic';

type InventionPageProps = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: InventionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entity = await loadInventionRecord(slug);
  if (!entity) {
    return { title: 'Invention not found' };
  }
  // The canonical is the record's own family address with no arrival query. A record page is
  // reachable under many arrival variants (map and list returns, prev/next), and without a
  // canonical each one reads to a crawler as a separate thin page.
  return {
    title: entity.displayName,
    description: entity.summary,
    alternates: {
      canonical: absolutePublicUrl(recordCanonicalPath(familyForKind(entity.kind), slug)),
    },
  };
}

export default async function InventionPage({ params, searchParams }: InventionPageProps) {
  const { slug } = await params;
  const rawArrival = (await searchParams) ?? {};
  const entity = await loadInventionRecord(slug);
  if (!entity) {
    notFound();
  }
  if (familyForKind(entity.kind) !== 'invention') {
    permanentRedirect(withQuery(`/place/${slug}`, recordArrivalQuery(rawArrival)));
  }
  const jsonLd = buildRecordJsonLd({
    family: 'invention',
    slug,
    displayName: entity.displayName,
    summary: entity.summary,
    jurisdictionLabel: entity.jurisdictionLabel,
  });
  // No nonce: a JSON-LD block is data, never executed, so script-src does not govern it.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {await EntityRecordPage({ entity, arrival: discoveryFromSearchParams(rawArrival) })}
    </>
  );
}
