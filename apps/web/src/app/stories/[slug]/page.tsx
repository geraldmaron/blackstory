/**
 * Story detail page at `/stories/[slug]` (chapters and short entries alike). The publication
 * layout: title → hero image → summary → body (prose with inline citations, figures, stat
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
import { nextInCollection } from '../stories-index';
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
          This story is temporarily unavailable while we reconnect to the live record.{' '}
          <Link href="/stories">Back to all stories</Link>.
        </Note>
      </Room>
    );
  }

  if (!result.article) notFound();
  const article = result.article;
  const { doc } = article;
  const jsonLd = buildArticleJsonLd(article);

  // The word this page uses for itself in its own copy: a long-form piece is a "chapter", a
  // short one is an "entry" — never "record" (that collides with the unrelated `/records`
  // archive index) and never "chapter" for both (that collides with `/stories`' own kind
  // filter, which uses "Chapter" to mean this kind specifically). See stories-index.ts.
  const noun = doc.kind === 'article' ? 'entry' : 'chapter';

  const chapterHeadings = extractChapterHeadings(article.blocks);

  // "Next in this collection" only needs the rest of the release's list items — the same
  // read `/stories` already does, cached per request, not a new query.
  const next = doc.series
    ? nextInCollection(
        (await listPublicArticleListItems()).items,
        doc.series.id,
        doc.series.position,
      )
    : undefined;

  // Ink spec §4 (/stories/[slug]): the sticky right rail carries "In this chapter/entry", the
  // reference list and "Next in this collection". The references list itself, its numbering and
  // its `#ref-N` anchor ids are unchanged (ArticleProse's citation superscripts link to those ids
  // regardless of where in the document the list renders) — only its position moves.
  const hasRailContent = chapterHeadings.length > 0 || next;
  const rail = hasRailContent ? (
    <div className="ds-article-rail">
      {chapterHeadings.length > 0 ? (
        <nav className="ds-room-rail-group" aria-labelledby="article-toc">
          <p className="ds-room-rail-group__title" id="article-toc">
            In this {noun}
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

  /*
   * The piece opens on its image, with the title written over it, on the same masthead the
   * record page uses. It used to open on a text header and put the hero underneath the summary,
   * which is the layout of a document that happens to have a picture attached rather than of a
   * piece of writing that leads with one. A piece with no hero keeps the same block on the
   * canvas: the type is the masthead in that case, and there is nothing to read it over.
   */
  const masthead = (
    <figure className="ds-article-mast" data-media={doc.heroImage ? 'photo' : 'none'}>
      {doc.heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.heroImage.url} alt={doc.heroImage.alt} />
      ) : null}
      <figcaption className="ds-article-mast__over">
        <p className="ds-article-mast__facts">
          {doc.series?.label ? (
            <Link
              className="ds-article-mast__series"
              href={`/stories?collection=${encodeURIComponent(doc.series.id)}`}
            >
              {doc.series.label}
            </Link>
          ) : null}
          {doc.series?.positionLabel ? (
            <span className="ds-mono">{doc.series.positionLabel}</span>
          ) : null}
          <span className="ds-mono">{doc.eraLabel}</span>
          <span>{doc.placeLabel}</span>
        </p>
        <h1 className="ds-article-mast__title">{doc.title}</h1>
        <p className="ds-article-mast__lede">{doc.summary}</p>
        <p className="ds-article-mast__byline">
          <span>
            Authored by <Link href="/about#neo-heading">Neo</Link>
          </span>
          <span>
            Published <span className="ds-mono">{doc.publishedAt}</span>
          </span>
          {doc.updatedAt ? (
            <span>
              Updated <span className="ds-mono">{doc.updatedAt}</span>
            </span>
          ) : null}
          {article.references.length > 0 ? (
            <span>
              Cites <a href="#about-this-chapter">{article.references.length} records</a>
            </span>
          ) : null}
        </p>
        {/* Inside the overlay, not beside it. The overlay is the element carrying the scrim, so
            a credit rendered as its sibling sat on bare photograph: subtle-ink text on a bright
            parchment scan, and a strip of un-dimmed image below the byline. It is hero text like
            the rest and belongs on the same ground. */}
        {doc.heroImage?.credit ? (
          <span className="ds-article-mast__credit ds-mono">{doc.heroImage.credit}</span>
        ) : null}
      </figcaption>
    </figure>
  );

  /*
   * The apparatus band. Every numbered mark in the text resolves here, under the piece rather
   * than beside its third paragraph: a reader checking a citation has finished the sentence, and
   * a reader who is not checking one should not be reading past a column of them.
   */
  const apparatus =
    article.references.length > 0 ? (
      <div className="ds-article-appx" id="about-this-chapter">
        <div className="ds-article-appx__head">
          <h2>About this {noun}</h2>
          <span>Every numbered mark in the text resolves here.</span>
        </div>
        <div className="ds-article-appx__cols">
          <div>
            <ArticleReferences references={article.references} headingId="about-this-chapter" />
          </div>
          <div className="ds-article-appx__notes">
            <section>
              <h3>How this {noun} was made</h3>
              <p>
                Written from released records only. Where two sources disagree the contradiction is
                shown rather than resolved.
              </p>
            </section>
            <section>
              <h3>Found a problem?</h3>
              <p>
                <Link href="/corrections">Submit a correction</Link> against any record cited above.
              </p>
            </section>
          </div>
        </div>
      </div>
    ) : undefined;

  return (
    <Room rail={rail} masthead={masthead} {...(apparatus ? { foot: apparatus } : {})}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="ds-article">
        <ArticleBody article={article} />

        <p className="ds-article__footer">
          <Link href="/stories">All stories</Link>
        </p>
      </article>
    </Room>
  );
}
