/** `/lives/[region]`: keep regional bookmarks resolving in the evidence appendix. */
import { notFound, permanentRedirect } from 'next/navigation';
import { livesAreaBySlug } from '@repo/domain/statistics/lives';
import type { RawLivesSearchParams } from '../../../lib/lives/lives-url-state';

type LivesAreaPageProps = {
  readonly params: Promise<{ readonly region: string }>;
  readonly searchParams: Promise<RawLivesSearchParams>;
};

export default async function LivesAreaPage({ params, searchParams }: LivesAreaPageProps) {
  const { region: slug } = await params;
  const area = livesAreaBySlug(slug);
  if (!area || area.kind !== 'region') notFound();
  const raw = await searchParams;
  const query = new URLSearchParams();
  query.set('area', area.slug);
  const decade = typeof raw.decade === 'string' ? raw.decade : raw.decade?.[0];
  const race = typeof raw.race === 'string' ? raw.race : raw.race?.[0];
  if (decade) query.set('decade', decade);
  if (race) query.set('race', race);
  permanentRedirect(`/lives/explorer?${query.toString()}`);
}
