/**
 * Legacy two-segment fact URL (`/facts/{id}/{slug}`).
 *
 * Always 301s to the canonical slug-only permalink. Kept so old bookmarks and citations keep
 * working without serving duplicate content.
 */
import { notFound, permanentRedirect } from 'next/navigation';
import { listLegacyFactPathParams, resolvePublicFact } from '../../resolve-public-fact';

type LegacyFactPageProps = {
  readonly params: Promise<{ readonly id: string; readonly slug: string }>;
};

export async function generateStaticParams() {
  return [...listLegacyFactPathParams()];
}

export default async function LegacyFactDetailRedirect({ params }: LegacyFactPageProps) {
  const { id, slug } = await params;
  const resolved = resolvePublicFact(id, slug);
  if (resolved.kind === 'not_found' || resolved.kind === 'not_public') {
    notFound();
  }
  if (resolved.kind === 'redirect') {
    permanentRedirect(resolved.destination);
  }
  // Defensive: resolvePublicFact always redirects when a second segment is present.
  permanentRedirect(resolved.kind === 'ok' ? `/facts/${resolved.fact.slug}` : '/facts');
}
