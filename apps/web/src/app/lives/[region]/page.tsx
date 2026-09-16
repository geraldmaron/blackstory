/**
 * `/lives/[region]`: 308 into the apparatus Lives figures, carrying the area and view query.
 */
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { LIVES_AREAS, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import {
  buildLivesHref,
  parseLivesSearchParams,
  type RawLivesSearchParams,
} from '../../../lib/lives/lives-url-state';

export const dynamicParams = false;

export function generateStaticParams(): { region: string }[] {
  return LIVES_AREAS.map((area) => ({ region: area.slug }));
}

type LivesAreaPageProps = {
  readonly params: Promise<{ readonly region: string }>;
  readonly searchParams: Promise<RawLivesSearchParams>;
};

export async function generateMetadata({ params }: LivesAreaPageProps): Promise<Metadata> {
  const { region: slug } = await params;
  const area = livesAreaBySlug(slug);
  if (!area) return {};
  return buildStaticPageMetadata({
    path: `/lives/${area.slug}`,
    title: `Lives across the decades: ${area.name}`,
    description: `${area.name}: how Black, white and Hispanic Americans were spread across class from the 1870s, what their lives measured, which laws were in force, and what the census could see.`,
    noIndex: true,
  });
}

export default async function LivesAreaPage({ params, searchParams }: LivesAreaPageProps) {
  const { region: slug } = await params;
  if (!livesAreaBySlug(slug)) notFound();
  const raw = await searchParams;
  permanentRedirect(buildLivesHref(slug, parseLivesSearchParams(raw)));
}
