/**
 * Legacy `/entity/{id}` addresses 308 to `/place/{slug}` so a reader never
 * stays on an internal catalog id.
 *
 * generateStaticParams stays empty so a build without DATABASE_URL cannot bake
 * seed pages. ISR metadata is kept for the hop; the body only redirects.
 */
import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicEntity } from '../../../data/public-seed';
import { resolvePublicEntityView } from '../../../lib/public-data/source';
import { placeHref } from '../../../lib/place/public-place-path';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';

export const revalidate = 3600;
export const dynamicParams = true;

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return [];
}

async function entityForAddress(id: string) {
  const seeded = getPublicEntity(id);
  if (seeded) return seeded;
  try {
    const resolved = await resolvePublicEntityView(id);
    if (resolved.data) return resolved.data;
  } catch {
    // A failed point-get must not become a catalog pull.
  }
  return undefined;
}

export async function generateMetadata({ params }: EntityPageProps) {
  const { id } = await params;
  const entity = await entityForAddress(id);
  if (!entity) {
    return { title: 'Record not found' };
  }
  return buildEntityPageMetadata({
    id: entity.id,
    displayName: entity.displayName,
    summary: entity.summary,
    kind: entity.kind,
    ...(entity.primaryImage !== undefined ? { imageUrl: entity.primaryImage.url } : {}),
  });
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const entity = await entityForAddress(id);
  if (!entity) {
    notFound();
  }
  permanentRedirect(placeHref(entity.displayName));
}
