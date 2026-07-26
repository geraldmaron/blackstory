/**
 * Articles index at `/articles`: the single long-form publication surface that
 * replaces the old /themes + /stories + /topics split. Thin list items load
 * from the active-release article projection; full bodies load on detail pages.
 */
import Link from 'next/link';
import { listPublicArticleListItems } from '../../lib/articles/source';
import './articles-edition.css';

export const metadata = {
  title: 'Articles',
  description:
    'Evidence-led long-form articles from the BlackStory archive: history pinned to place and records, with every figure and claim cited inline.',
};

export default async function ArticlesIndexPage() {
  const { items, source } = await listPublicArticleListItems();

  return (
    <div className="ds-articles-edition">
      <main className="ds-container ds-page" id="main">
        <div className="ds-articles-edition__stack">
          <header className="ds-articles-edition__intro">
            <p className="ds-articles-edition__kicker">Articles</p>
            <h1 className="ds-articles-edition__title">
              History pinned to <em>place</em> and <em>record</em>.
            </h1>
            <p className="ds-articles-edition__lede">
              Long-form pieces that walk from a named year and place through the rules in force and
              the measured odds under them. Every figure and quotation cites the record it rests on.
            </p>
          </header>

          {source === 'unavailable' ? (
            <p className="ds-articles-edition__notice">
              Articles are temporarily unavailable while we reconnect to the live record. Nothing
              here is lost; please check back shortly.
            </p>
          ) : items.length === 0 ? (
            <p className="ds-articles-edition__notice">No articles are published yet.</p>
          ) : (
            <ul className="ds-articles-grid">
              {items.map((item) => (
                <li key={item.slug} className="ds-articles-grid__item">
                  <Link className="ds-article-card" href={`/articles/${item.slug}`}>
                    {item.heroImage ? (
                      <span className="ds-article-card__media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.heroImage.url}
                          alt={item.heroImage.alt}
                          loading="lazy"
                        />
                      </span>
                    ) : null}
                    <span className="ds-article-card__meta">
                      {item.eraLabel} · {item.placeLabel}
                    </span>
                    <span className="ds-article-card__title">{item.title}</span>
                    <span className="ds-article-card__summary">{item.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
