/**
 * The front page's contents, on paper under the retelling (docs/ui/DESIGN.md section 9.7): the
 * four areas, each with the destination catalog's own line and a link, and search.
 *
 * No count is set as display type here, and nothing harm-adjacent is shown: the one image is the
 * lead story's cover, and only when `frontSafeCover` lists it.
 */
import React from 'react';
import Link from 'next/link';
import { buttonClassName } from '@repo/ui';
import { semanticDestinationById, storyPath } from '@repo/public-contracts/destinations';
import { frontSafeCover } from '../../lib/stories/cover-safety';
import { listPublicStoryListItems } from '../../lib/stories/source';
import { buildStoriesFront } from '../stories/stories-index';
import { CoverImage } from '../stories/StoriesIndexParts';
import { FRONT_ROUTES } from './front-routes';

void React;

const lineOf = (id: string) => semanticDestinationById(id)?.description ?? '';

export async function FrontContents() {
  const stories = await listPublicStoryListItems().catch(() => ({ items: [] as const }));
  const lead = stories.items.length > 0 ? buildStoriesFront(stories.items).lead : undefined;
  const cover = lead ? frontSafeCover(lead) : undefined;

  return (
    <div className="ds-front-contents" id="contents" data-ground="paper">
      <section aria-labelledby="front-contents-h">
        <h2 className="ds-front-contents__title" id="front-contents-h">
          In the archive
        </h2>
        <form className="ds-front-contents__search" action={FRONT_ROUTES.search} role="search">
          <label htmlFor="front-search">Search the archive</label>
          <div>
            <input
              id="front-search"
              name="q"
              type="search"
              placeholder="A town, a name, a year"
              autoComplete="off"
            />
            <button type="submit" className={buttonClassName('primary')}>
              Search
            </button>
          </div>
        </form>
        <ul className="ds-front-contents__list">
          <li>
            <h3>Archive</h3>
            <p>
              {lineOf('explore')} {lineOf('records')}
            </p>
            <p className="ds-front-contents__links">
              <Link href={FRONT_ROUTES.archive}>Open the map</Link>
              <Link href={FRONT_ROUTES.list}>Browse the list</Link>
            </p>
          </li>
          <li>
            <h3>Stories</h3>
            <p>{lineOf('stories')}</p>
            {lead ? (
              <p className="ds-front-contents__lead">
                {cover ? (
                  <span className="ds-front-contents__cover">
                    <CoverImage item={lead} width={480} />
                    <span>{cover.credit}</span>
                  </span>
                ) : null}
                <Link href={storyPath(lead.slug, lead.collection?.id)}>{lead.title}</Link>
              </p>
            ) : null}
            <p className="ds-front-contents__links">
              <Link href={FRONT_ROUTES.stories}>Read the stories</Link>
            </p>
          </li>
          <li>
            <h3>Data</h3>
            <p>{lineOf('data')}</p>
            <p className="ds-front-contents__links">
              <Link href={FRONT_ROUTES.data}>See the figures</Link>
            </p>
          </li>
          <li>
            <h3>Memorial</h3>
            <p>{lineOf('memorial')}</p>
            <p className="ds-front-contents__links">
              <Link href={FRONT_ROUTES.memorial}>Visit the memorial</Link>
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
