/**
 * Article cover form for one story. Publish is blocked without a valid package.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCoverArticle } from '../../../../stories/cover-article-catalog';
import { COVER_FORM_INTENT } from '../../../../stories/cover-package-copy';
import { getStoredCoverArticle } from '../../../../stories/cover-package-store';
import { CoverPackageForm } from './cover-form';
import '../articles.css';

export const metadata = {
  title: 'Article cover package',
  description: 'Human brief, recipe, and plate citing the house lock. No brief, no cover.',
};

type ArticleCoverPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export default async function ArticleCoverPage({ params }: ArticleCoverPageProps) {
  const { slug } = await params;
  const article = getCoverArticle(slug);
  if (!article) notFound();
  const stored = getStoredCoverArticle(slug);

  return (
    <main className="cover-articles ds-container ds-page" id="main">
      <header>
        <p className="ds-page__eyebrow">Publication</p>
        <h1 className="ds-page__title">Cover package</h1>
        <p className="ds-page__lede">{COVER_FORM_INTENT}</p>
        <p className="cover-articles__meta">
          {article.title}
          {article.eraLabel ? ` · ${article.eraLabel}` : ''}
          {article.placeLabel ? ` · ${article.placeLabel}` : ''}
          {article.fromSeed ? ' · seed article' : ' · draft slug'}
        </p>
      </header>
      <p className="ds-sans">
        <Link href="/stories/articles">All article covers</Link>
        {' · '}
        <Link href="/stories/review">Story review</Link>
      </p>
      <CoverPackageForm article={article} stored={stored} />
    </main>
  );
}
