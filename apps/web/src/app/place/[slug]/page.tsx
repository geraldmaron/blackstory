/**
 * A published place at a public slug. Walked into from the map. The title is
 * the place. Back is BlackStory at `/`. Never `/entity/ent_…`.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeFirstPaint } from '../../HomeFirstPaint';
import { loadHomeFirstPaint } from '../../home-first-paint';
import { isPublicPlaceSlug } from '../../../lib/place/public-place-path';

export const dynamic = 'force-dynamic';

type PlacePageProps = {
  readonly params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isPublicPlaceSlug(slug)) {
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

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;
  if (!isPublicPlaceSlug(slug)) {
    notFound();
  }
  const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
  if (!model.lead) {
    notFound();
  }
  return <HomeFirstPaint model={model} />;
}
