/**
 * A published invention at a public slug.
 *
 * Its own family because an invention is a work, not a stand: Latimer's carbon-manufacturing
 * process happens at no coordinate a reader can walk to, and an invention needs no patent and
 * no address to exist. It rode `/place/{slug}` only because the stand test admits anything that
 * is not a living private person, which is a test for who may be named, not for what a place is.
 *
 * The room is shared with Place (`app/record-first-paint.tsx`); only the family differs. A
 * non-invention requested here permanently redirects to `/place/{slug}`.
 */
import type { Metadata } from 'next';
import { RecordFirstPaint, recordFirstPaintMetadata } from '../../record-first-paint';

export const dynamic = 'force-dynamic';

type InventionPageProps = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: InventionPageProps): Promise<Metadata> {
  const { slug } = await params;
  return recordFirstPaintMetadata('invention', slug);
}

export default async function InventionPage({ params, searchParams }: InventionPageProps) {
  const { slug } = await params;
  return RecordFirstPaint({ family: 'invention', slug, searchParams: await searchParams });
}
