/**
 * Chapters index at `/chapters`: the single long-form publication surface that
 * replaces the old /themes + /stories + /topics + /articles split. Thin list
 * items load from the active-release article projection; full bodies load on
 * detail pages.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { listPublicArticleListItems } from '../../lib/articles/source';
import { Room, RoomHeader } from '../../components/room';
import '../reading-room.css';
// Retained for the chapter card itself, which carries a hero image the kit's RoomCard does not.
import './articles-edition.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/chapters',
  title: 'Chapters',
  description:
    'Evidence-led long-form chapters from the BlackStory archive: history pinned to place and records, with every figure and claim cited inline.',
});

export default async function ChaptersIndexPage() {
  const { items, source } = await listPublicArticleListItems();

  return (
    <Room>
      <RoomHeader
        pathname="/chapters"
        kicker="Chapters"
        title="History pinned to place and record."
        lede="Long-form pieces that walk from a named year and place through the rules in force and the measured odds under them. Every figure and quotation cites the record it rests on."
      />

      {source === 'unavailable' ? (
        <p className="ds-articles-edition__notice">
          Articles are temporarily unavailable while we reconnect to the live record. Nothing here
          is lost; please check back shortly.
        </p>
      ) : items.length === 0 ? (
        <p className="ds-articles-edition__notice">No chapters are published yet.</p>
      ) : (
        <ul className="ds-articles-grid">
          {items.map((item) => (
            <li key={item.slug} className="ds-articles-grid__item">
              <Link className="ds-article-card" href={`/chapters/${item.slug}`}>
                {item.heroImage ? (
                  <span className="ds-article-card__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.heroImage.url} alt={item.heroImage.alt} loading="lazy" />
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
    </Room>
  );
}
