/**
 * A published place at a public slug. Walked into from the map. The title is
 * the place. Back is BlackStory at `/`. Never `/entity/ent_…`.
 * Arrival query params may carry DiscoveryState for map/list return and list prev/next.
 *
 * An invention that still holds an indexed place address permanently redirects to
 * `/invention/{slug}`; the room itself is shared (`app/record-first-paint.tsx`).
 */
import type { Metadata } from 'next';
import { RecordFirstPaint, recordFirstPaintMetadata } from '../../record-first-paint';

export const dynamic = 'force-dynamic';

type PlacePageProps = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  return recordFirstPaintMetadata('place', slug);
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { slug } = await params;
  return RecordFirstPaint({ family: 'place', slug, searchParams: await searchParams });
}
