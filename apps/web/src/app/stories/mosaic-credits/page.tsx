/**
 * Archive mosaic credits: lists the rights-cleared collage tiles used as
 * decorative atmosphere on story pages and the about-page living mosaic.
 */
import Link from 'next/link';
import { ATMOSPHERE_TILE_CREDITS } from '../../../components/atmosphere';
import { EditionAtmosphereMosaic } from '../../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  STORIES_EDITION_MOSAIC_SEED,
  storiesEditionPanelClassName,
  storiesEditionRootClassName,
  storiesEditionStackClassName,
} from '../stories-panel-chrome';
import '../stories-edition.css';

export const metadata = {
  title: 'Archive mosaic credits',
  description:
    'Source credits for the rights-cleared archive mosaic tiles used as symbolic atmosphere on BlackStory story and about pages.',
};

export default function MosaicCreditsPage() {
  return (
    <div className={storiesEditionRootClassName()} data-stories-edition="v6">
      <EditionAtmosphereMosaic seedKey={`${STORIES_EDITION_MOSAIC_SEED}:credits`} count={12} />
      <main className="ds-container ds-page" id="main">
        <div className={storiesEditionStackClassName()}>
          <article className={storiesEditionPanelClassName('intro')}>
            <header className="ds-stories-edition__header">
              <span className="ds-stories-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-stories-edition__kicker">Attribution</p>
                <h1 className="ds-stories-edition__title">
                  Archive mosaic <em>credits</em>
                </h1>
                <p className="ds-stories-edition__lede">
                  Story pages may show a soft black-and-white mosaic in the page gutters. Those tiles
                  are rights-cleared archive images, served from this site (never hotlinked from
                  Wikimedia at request time). The mosaic is symbolic atmosphere, not a photograph of
                  a page subject.
                </p>
              </div>
            </header>
          </article>

          <article
            className={storiesEditionPanelClassName('credits')}
            aria-labelledby="tile-list-heading"
          >
            <p className="ds-stories-edition__panel-title">Tile pool</p>
            <h2 className="ds-stories-edition__panel-heading" id="tile-list-heading">
              {ATMOSPHERE_TILE_CREDITS.length} curated tiles
            </h2>
            <p className="ds-stories-edition__lede">
              Each tile maps to a published entity primary image (GCS public-media). Rebuild the local
              pool with the collage tile script when the Commons promote set changes.
            </p>
            <ol className="ds-story-mosaic-credits">
              {ATMOSPHERE_TILE_CREDITS.map((tile) => (
                <li key={tile.index} className="ds-story-mosaic-credits__item">
                  <span className="ds-mono ds-story-mosaic-credits__index">{tile.index}</span>
                  <div>
                    <p className="ds-story-mosaic-credits__entity">
                      <Link href={`/entity/${tile.entityId}`}>{tile.entityId}</Link>
                    </p>
                    <p className="ds-mono ds-story-mosaic-credits__path">{tile.path}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <p className="ds-stories-edition__footer">
            <Link href="/stories">All stories</Link>
            {' · '}
            <Link href="/about">About</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
