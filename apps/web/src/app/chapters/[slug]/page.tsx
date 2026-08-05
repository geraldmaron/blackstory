/**
 * Chapter detail page at `/chapters/[slug]`. The publication layout: title →
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
import { resolveArticle, listPublishedArticleSlugs } from '../../../lib/articles/source';
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
    alternates: { canonical: `/chapters/${doc.slug}` },
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
    '@id': `/chapters/${doc.slug}`,
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
          <Link href="/chapters">Back to all chapters</Link>.
        </Note>
      </Room>
    );
  }

  if (!result.article) notFound();
  const article = result.article;
  const { doc } = article;
  const jsonLd = buildArticleJsonLd(article);

  return (
    <Room>
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
          <Link href="/chapters">All chapters</Link>
        </p>
      </article>
    </Room>
  );
}
