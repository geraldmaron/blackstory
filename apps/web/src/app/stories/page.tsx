/**
 * Stories index: longform history narratives pinned to place and evidence.
 *
 * v6 edition Surface stack with shared gutter mosaic atmosphere. Thin list items
 * load from the public release story projection; full bodies load on article pages.
 */
import Link from 'next/link';
import { EditionAtmosphereMosaic } from '../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  EDITION_MOSAIC_COUNT_BROWSE,
} from '../../components/patterns/edition-atmosphere/edition-atmosphere-config';
import { listPublicStoryListItems } from '../../lib/public-data/source';
import {
  STORIES_EDITION_MOSAIC_SEED,
  storiesEditionPanelClassName,
  storiesEditionRootClassName,
  storiesEditionStackClassName,
} from './stories-panel-chrome';
import './stories-edition.css';

export const metadata = {
  title: 'Stories',
  description:
    'Longform history from the BlackStory archive: place-first articles with sources and links to records.',
};

export default async function StoriesIndexPage() {
  const { data: stories } = await listPublicStoryListItems();
  const countLabel = stories.length === 1 ? '1 story' : `${stories.length} stories`;

  return (
    <div className={storiesEditionRootClassName()} data-stories-edition="v6">
      <EditionAtmosphereMosaic seedKey={STORIES_EDITION_MOSAIC_SEED} count={EDITION_MOSAIC_COUNT_BROWSE} />
      <main className="ds-container ds-page" id="main">
        <div className={storiesEditionStackClassName()}>
          <article className={storiesEditionPanelClassName('intro')}>
            <header className="ds-stories-edition__header">
              <span className="ds-stories-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-stories-edition__kicker">Longform</p>
                <h1 className="ds-stories-edition__title">
                  History pinned to <em>place</em>.
                </h1>
                <p className="ds-stories-edition__lede">
                  Each piece links to the records it rests on, with sources you can open. Era and
                  geography stay visible in every entry.
                </p>
                <p className="ds-stories-edition__crosslink">
                  <Link className="ds-cta-link" href="/books">
                    Banned books catalog
                  </Link>
                </p>
              </div>
            </header>
          </article>

          <article
            className={storiesEditionPanelClassName('catalog')}
            aria-labelledby="stories-list-heading"
          >
            <p className="ds-stories-edition__panel-title">Catalog</p>
            <h2 className="ds-stories-edition__panel-heading" id="stories-list-heading">
              Published stories
            </h2>
            <p className="ds-stories-edition__count">{countLabel}</p>
            <ul className="ds-story-rail ds-story-rail--grid">
              {stories.map((story) => (
                <li key={story.slug}>
                  <Link className="ds-story-link" href={`/stories/${story.slug}`}>
                    <span className="ds-story-link__meta">
                      {story.eraLabel} · {story.placeLabel}
                    </span>
                    <h3 className="ds-story-link__title">{story.title}</h3>
                    <p className="ds-story-link__summary">{story.dek}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </main>
    </div>
  );
}
