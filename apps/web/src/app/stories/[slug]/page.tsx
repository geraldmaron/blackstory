/**
 * Story detail page at `/stories/[slug]` (chapters and record articles alike). The publication layout: title →
 * hero image → summary → body (prose with inline citations, figures, stat
 * callouts, primary documents, timelines, map insets, disputes) → numbered
 * references. Emits schema.org Article JSON-LD only.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { ArticleBody } from '../../../components/article/ArticleBody';
import { ArticleReferences } from '../../../components/article/ArticleReferences';
import type { HydratedArticle } from '../../../lib/articles/hydrate';
import { extractChapterHeadings } from '../../../lib/articles/heading-anchors';
import {
  resolveArticle,
  listPublishedArticleSlugs,
  listPublicArticleListItems,
} from '../../../lib/articles/source';
import { nextInSeries } from '../stories-index';
import { Note, Room } from '../../../components/room';
import '../../reading-room.css';
import '../../../components/article/article.css';
import '../../../components/theme-spine/theme-spine.css';
import '../../../components/theme-impact/theme-impact.css';

type ArticlePageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await listPublishedArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const result = await resolveArticle(slug);
  if (!result.article) return { title: 'Article not found' };
  const { doc } = result.article;
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: `/stories/${doc.slug}` },
  };
}

function buildArticleJsonLd(article: HydratedArticle) {
  const { doc } = article;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.summary,
    datePublished: doc.publishedAt,
    ...(doc.updatedAt ? { dateModified: doc.updatedAt } : {}),
    '@id': `/stories/${doc.slug}`,
    author: { '@type': 'Organization', name: 'BlackStory' },
    ...(doc.heroImage ? { image: doc.heroImage.url } : {}),
  };
  assertNeverClaimReview(jsonLd);
  return jsonLd;
}

export default async function ArticleDetailPage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const result = await resolveArticle(slug);

  if (result.source === 'unavailable') {
    return (
      <Room>
        <Note kind="Unavailable">
          This chapter is temporarily unavailable while we reconnect to the live record.{' '}
          <Link href="/stories">Back to all stories</Link>.
        </Note>
      </Room>
    );
  }

  if (!result.article) notFound();
  const article = result.article;
  const { doc } = article;
  const jsonLd = buildArticleJsonLd(article);

  const chapterHeadings = extractChapterHeadings(article.blocks);

  // "Next in this collection" only needs the rest of the release's list items — the same
  // read `/stories` already does, cached per request, not a new query.
  const next = doc.series
    ? nextInSeries(
        (await listPublicArticleListItems()).items,
        doc.series.id,
        doc.series.position,
      )
    : undefined;

  // Ink spec §4 (/stories/[slug]): the sticky right rail carries "In this chapter", "Records
  // cited" and "Next in this collection". The references list itself, its numbering and its
  // `#ref-N` anchor ids are unchanged (ArticleProse's citation superscripts link to those ids
  // regardless of where in the document the list renders) — only its position moves.
  const hasRailContent = chapterHeadings.length > 0 || article.references.length > 0 || next;
  const rail = hasRailContent ? (
    <div className="ds-article-rail">
      {chapterHeadings.length > 0 ? (
        <nav className="ds-room-rail-group" aria-labelledby="article-toc">
          <p className="ds-room-rail-group__title" id="article-toc">
            In this chapter
          </p>
          <ul className="ds-room-rail-group__list">
            {chapterHeadings.map((heading) => (
              <li key={heading.id}>
                <a className="ds-room-rail-group__link" href={`#${heading.id}`}>
                  <span className="ds-room-rail-group__label">{heading.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {article.references.length > 0 ? (
        <div className="ds-room-rail-group">
          <p className="ds-room-rail-group__title" id="article-references">
            Records cited
          </p>
          <ArticleReferences references={article.references} headingId="article-references" />
        </div>
      ) : null}

      {next ? (
        <div className="ds-article-rail__next">
          <p className="ds-room-rail-group__title">Next in this collection</p>
          <a className="ds-article-rail__next-link" href={`/stories/${next.slug}`}>
            {next.series?.positionLabel ? (
              <span className="ds-mono ds-article-rail__next-position">
                {next.series.positionLabel}
              </span>
            ) : null}
            <span className="ds-article-rail__next-title">{next.title}</span>
          </a>
        </div>
      ) : null}
    </div>
  ) : undefined;

  return (
    <Room rail={rail}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="ds-article">
        <header className="ds-article__header">
          <p className="ds-article__meta-row">
            <span className="ds-mono">{doc.eraLabel}</span> · {doc.placeLabel}
          </p>
          <h1 className="ds-article__title">{doc.title}</h1>
          <p className="ds-article__summary">{doc.summary}</p>
          <p className="ds-article__byline ds-mono">
            Published {doc.publishedAt}
            {doc.updatedAt ? ` · Updated ${doc.updatedAt}` : ''}
          </p>
        </header>

        {doc.heroImage ? (
          <figure className="ds-article__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doc.heroImage.url} alt={doc.heroImage.alt} />
            <figcaption className="ds-article__figcaption">
              <span className="ds-article__credit">{doc.heroImage.credit}</span>
            </figcaption>
          </figure>
        ) : null}

        <ArticleBody article={article} />

        <p className="ds-article__footer">
          <Link href="/stories">All stories</Link>
        </p>
      </article>
    </Room>
  );
}
