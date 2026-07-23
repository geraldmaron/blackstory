/**
 * Stories index: longform history narratives pinned to place and evidence.
 *
 * Loads thin list items from the public release story projection (field-masked
 * Firestore / Firebase seed) — title, dek, era, and place only. Full bodies
 * load on the article page. Index chrome is denser than the shared story-rail
 * used on home/entity (see stories.css under `.ds-stories-page`).
 */
import Link from 'next/link';
import { listPublicStoryListItems } from '../../lib/public-data/source';
import './stories.css';

export const metadata = {
  title: 'Stories',
  description:
    'Longform history from the BlackStory archive: place-first articles with sources and links to records.',
};

export default async function StoriesIndexPage() {
  const { data: stories } = await listPublicStoryListItems();
  const countLabel = stories.length === 1 ? '1 story' : `${stories.length} stories`;

  return (
    <main className="ds-container ds-page ds-stories-page" id="main">
      <p className="ds-page__eyebrow">Longform</p>
      <h1 className="ds-page__title">Stories</h1>
      <p className="ds-page__lede">
        History pinned to place and era. Each piece links to the records it rests on, with sources
        you can open.
      </p>
      <p className="ds-stories-page__crosslink">
        <Link className="ds-cta-link" href="/books">
          Banned books catalog
        </Link>
      </p>

      <section className="ds-section ds-section--flush ds-stories-page__list" aria-label="Story list">
        <p className="ds-sans ds-count-label ds-stories-page__count" id="stories-list-heading">
          {countLabel}
        </p>
        <ul className="ds-story-rail" aria-labelledby="stories-list-heading">
          {stories.map((story) => (
            <li key={story.slug}>
              <Link className="ds-story-link" href={`/stories/${story.slug}`}>
                <span className="ds-story-link__meta">
                  {story.eraLabel} · {story.placeLabel}
                </span>
                <h2 className="ds-story-link__title">{story.title}</h2>
                <p className="ds-story-link__summary">{story.dek}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
