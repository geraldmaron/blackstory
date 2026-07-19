/**
 * Stories index — longform history narratives pinned to place and evidence.
 *
 * Replaces the former Topics thematic shortcuts with an article library. Seed content stands
 * in for a published editorial projection.
 */
import Link from 'next/link';
import { listSeedStories } from '../../data/stories-seed';

export const metadata = {
  title: 'Stories',
  description:
    'Longform history narratives from the BlackStory archive — place-first articles with links to records and quick facts.',
};

export default function StoriesIndexPage() {
  const stories = listSeedStories();

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">From the archive</p>
      <h1 className="ds-page__title">Stories</h1>
      <p className="ds-page__lede">
        Longform history from the record — narratives pinned to place, era, and evidence. Each story
        off-ramps to the entities and quick facts it rests on.
      </p>

      <section className="ds-section ds-section--flush" aria-label="Story list">
        <ul className="ds-story-rail">
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
