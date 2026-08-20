/**
 * Anchor ids for a chapter's top-level (h2) section headings — the single source of truth
 * for both the heading elements themselves (ArticleBody) and the "In this chapter" rail nav
 * (stories/[slug]/page.tsx), so the two can never drift out of sync.
 */
import type { HydratedArticleBlock } from './hydrate';

function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length > 0 ? slug : 'section';
}

export type ChapterHeading = {
  readonly id: string;
  readonly text: string;
  readonly blockIndex: number;
};

/**
 * Top-level (h2) section headings, in reading order, each with a unique DOM anchor id.
 * h3 subheadings are not included — the rail links to sections, not every subsection.
 */
export function extractChapterHeadings(
  blocks: readonly HydratedArticleBlock[],
): readonly ChapterHeading[] {
  const seen = new Map<string, number>();
  const headings: ChapterHeading[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type !== 'heading' || block.level !== 2) return;
    const base = slugifyHeading(block.text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    headings.push({ id, text: block.text, blockIndex });
  });
  return headings;
}
