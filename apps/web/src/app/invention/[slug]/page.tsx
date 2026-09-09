/**
 * A published invention at a public slug.
 *
 * Its own family because an invention is a work, not a stand: Latimer's carbon-manufacturing
 * process happens at no coordinate a reader can walk to, and an invention needs no patent and no
 * address to exist. It rode `/place/{slug}` only because the stand test admits anything that is
 * not a living private person, which is a test for who may be named, not for what a place is.
 *
 * It renders the RECORD room, not Place's map-led first-paint room. The question a reader brings
 * to an invention is who made it, what it was, and what changed — inventor, patent receipt,
 * impact beat, sources — and the first-paint room answers where something is instead. The pin
 * still exists on the record where the cohort documented a work site, labelled as the work site.
 *
 * A slug that resolves to anything other than an invention permanently redirects to `/place/`,
 * which is the mirror of the invention redirect the place page does.
 */
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { EntityRecordRoom } from '../../entity/[id]/EntityRecordRoom';
import { familyForKind } from '../../record-first-paint';
import {
  isResolvablePlaceSlug,
  resolvePlaceSlugFromSearchIndex,
} from '../../../lib/place/place-slug';
import { getPublicSearchIndex, resolvePublicEntityView } from '../../../lib/public-data/source';

export const dynamic = 'force-dynamic';

type InventionPageProps = {
  readonly params: Promise<{ slug: string }>;
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

export default async function InventionPage({ params }: InventionPageProps) {
  const { slug } = await params;
  const entity = await resolveInventionSlug(slug);
  if (!entity) {
    notFound();
  }
  if (familyForKind(entity.kind) !== 'invention') {
    permanentRedirect(`/place/${slug}`);
  }
  return EntityRecordRoom({ entity });
}
