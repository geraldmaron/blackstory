/**
 * Articles an editor can open for a cover package. Seed longform stories are
 * the real desk; a packet slug can open a stub so review can hand off here.
 */
import { listSeedStoryProjections } from '@repo/domain/publication/public-story-seed';

export type CoverArticleRecord = {
  readonly slug: string;
  readonly title: string;
  readonly dek: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly fromSeed: boolean;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCoverArticleId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled-story'
  );
}

export function isCoverArticleSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function articleCoverPath(slug: string): string {
  return `/stories/articles/${slug}`;
}

export function listCoverArticles(): readonly CoverArticleRecord[] {
  return listSeedStoryProjections().map(seedToRecord);
}

export function getCoverArticle(slug: string): CoverArticleRecord | null {
  if (!isCoverArticleSlug(slug)) return null;
  const seed = listSeedStoryProjections().find((story) => story.slug === slug);
  if (seed) return seedToRecord(seed);
  return {
    slug,
    title: slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    dek: '',
    eraLabel: '',
    placeLabel: '',
    fromSeed: false,
  };
}

function seedToRecord(
  story: ReturnType<typeof listSeedStoryProjections>[number],
): CoverArticleRecord {
  return {
    slug: story.slug,
    title: story.title,
    dek: story.dek,
    eraLabel: story.eraLabel,
    placeLabel: story.placeLabel,
    fromSeed: true,
  };
}
