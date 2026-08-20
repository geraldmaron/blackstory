/**
 * Story detail page at `/stories/[slug]` (chapters and record articles alike). The publication layout: title →
 * hero image → summary → body (prose with inline citations, figures, stat
 * callouts, primary documents, timelines, map insets, disputes) → numbered
 * references. Emits schema.org Article JSON-LD only.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertNeverClaimReview } from '@repo/domain';
import { ArticleBody, chapterToc } from '../../../components/article/ArticleBody';
import { ArticleReferences } from '../../../components/article/ArticleReferences';
import type { HydratedArticle } from '../../../lib/articles/hydrate';
import {
  resolveArticle,
  listPublishedArticleSlugs,
  listPublicArticleListItems,
} from '../../../lib/articles/source';
import { listPublicEntityViewsByIds } from '../../../lib/public-data/source';
import { KindGlyph } from '../../../components/map-experience/KindGlyph';
import { Note, RailGroup, Room } from '../../../components/room';
import { nextInCollection } from './article-rail';
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

  // Rail content — sticky margin rail, Ink direction. Every piece here reads data the page
  // (or /stories, for the collection lookup) already fetches elsewhere; nothing new.
  const toc = chapterToc(article);
  const [citedRecords, collectionItems] = await Promise.all([
    doc.relatedEntityIds.length > 0
      ? listPublicEntityViewsByIds(doc.relatedEntityIds)
      : Promise.resolve({ data: [] as const }),
    doc.series ? listPublicArticleListItems() : Promise.resolve({ items: [] as const }),
  ]);
  const next = doc.series
    ? nextInCollection(doc.series.id, doc.series.position, doc.slug, collectionItems.items)
    : undefined;

  const rail =
    toc.length > 0 || citedRecords.data.length > 0 || next ? (
      <div className="ds-article-rail">
        {toc.length > 0 ? (
          <RailGroup
            title="In this chapter"
            entries={toc.map((entry) => ({ label: entry.text, href: `#${entry.id}` }))}
          />
        ) : null}
        {citedRecords.data.length > 0 ? (
          <RailGroup
            title="Records cited"
            entries={citedRecords.data.map((entity) => ({
              label: entity.displayName,
              href: `/entity/${entity.id}`,
              glyph: <KindGlyph kind={entity.kind} size={12} />,
            }))}
          />
        ) : null}
        {next ? (
          <section className="ds-article-rail__next">
            <p className="ds-article-rail__next-kicker">Next in this collection</p>
            {next.positionLabel ? (
              <p className="ds-article-rail__next-position">{next.positionLabel}</p>
            ) : null}
            <a className="ds-article-rail__next-title" href={next.href}>
              {next.title}
            </a>
          </section>
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

        <section className="ds-article__references-section" aria-labelledby="article-references">
          <h2 className="ds-article__heading ds-article__heading--2" id="article-references">
            References
          </h2>
          <ArticleReferences references={article.references} headingId="article-references" />
        </section>

        <p className="ds-article__footer">
          <Link href="/stories">All stories</Link>
        </p>
      </article>
    </Room>
  );
}
