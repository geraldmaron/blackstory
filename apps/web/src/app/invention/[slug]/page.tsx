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
import {
  discoveryFromSearchParams,
  recordArrivalQuery,
  withQuery,
} from '../../../lib/discovery/discovery-state';
import {
  isResolvablePlaceSlug,
  resolvePlaceSlugFromSearchIndex,
} from '../../../lib/place/place-slug';
import { getPublicSearchIndex, resolvePublicEntityView } from '../../../lib/public-data/source';

export const dynamic = 'force-dynamic';

type InventionPageProps = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Resolve a public invention slug to its release entity, or nothing. */
async function resolveInventionSlug(slug: string) {
  if (!isResolvablePlaceSlug(slug)) return undefined;
  const index = await getPublicSearchIndex();
  const id = resolvePlaceSlugFromSearchIndex(index.data, slug);
  if (id === undefined) return undefined;
  return (await resolvePublicEntityView(id)).data ?? undefined;
}

export async function generateMetadata({ params }: InventionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveInventionSlug(slug);
  if (!entity) {
    return { title: 'Invention not found' };
  }
  return { title: entity.displayName, description: entity.summary };
}

export default async function InventionPage({ params, searchParams }: InventionPageProps) {
  const { slug } = await params;
  const rawArrival = (await searchParams) ?? {};
  const entity = await resolveInventionSlug(slug);
  if (!entity) {
    notFound();
  }
  if (familyForKind(entity.kind) !== 'invention') {
    permanentRedirect(withQuery(`/place/${slug}`, recordArrivalQuery(rawArrival)));
  }
  return EntityRecordPage({ entity, arrival: discoveryFromSearchParams(rawArrival) });
}
