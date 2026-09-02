/**
 * Article cover index. Open a real seed story and run it through the cover gate.
 */
import Link from 'next/link';
import { articleCoverPath, listCoverArticles } from '../../../stories/cover-article-catalog';
import { COVER_FORM_INTENT } from '../../../stories/cover-package-copy';
import './articles.css';

export const metadata = {
  title: 'Article covers',
  description: 'Attach a fail-closed cover package before an article can publish.',
};

export default function ArticleCoverIndexPage() {
  const articles = listCoverArticles();

  return (
    <main className="cover-articles ds-container ds-page" id="main">
      <header>
        <p className="ds-page__eyebrow">Publication</p>
        <h1 className="ds-page__title">Article covers</h1>
        <p className="ds-page__lede">{COVER_FORM_INTENT}</p>
      </header>
      <p className="ds-sans">
        Open a real article and complete the brief, recipe, and plate. Story review still does not
        publish. This form is the cover gate.{' '}
        <Link href="/stories/review">Back to story review</Link>.
      </p>
      <ul className="cover-articles__list">
        {articles.map((article) => (
          <li key={article.slug} className="cover-articles__row">
            <Link href={articleCoverPath(article.slug)}>{article.title}</Link>
            <p className="cover-articles__meta">
              {article.eraLabel} · {article.placeLabel} · {article.slug}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
