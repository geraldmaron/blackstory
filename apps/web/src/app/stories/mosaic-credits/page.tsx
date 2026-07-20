/**
 * Archive mosaic credits: lists the rights-cleared collage tiles used as
 * decorative atmosphere on story masts and the about-page living mosaic.
 * Tiles are local copies of Commons promotions; this page satisfies attribution
 * for licensed sources used symbolically (never as portraits of a subject).
 */
import Link from 'next/link';
import { ATMOSPHERE_TILE_CREDITS } from '../../../components/atmosphere';
import '../stories.css';

export const metadata = {
  title: 'Archive mosaic credits',
  description:
    'Source credits for the rights-cleared archive mosaic tiles used as symbolic atmosphere on BlackStory story and about pages.',
};

export default function MosaicCreditsPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
        <p className="ds-page__eyebrow">Attribution</p>
        <h1 className="ds-page__title">
          Archive mosaic <em>credits</em>
        </h1>
        <p className="ds-page__lede">
          Story masts and the about page may show a soft black-and-white mosaic. Those tiles are
          rights-cleared archive images, served from this site (never hotlinked from Wikimedia at
          request time). The mosaic is symbolic atmosphere, not a photograph of a page subject. On
          about, tiles periodically swap from the broader pool; motion stops under reduced-motion or
          Save-Data. When a tile matches a published record, it opens that entity page.
        </p>
      </header>

      <section className="ds-section" aria-labelledby="tile-list-heading">
        <p className="ds-section__kicker">Tile pool</p>
        <h2 className="ds-section__title" id="tile-list-heading">
          {ATMOSPHERE_TILE_CREDITS.length} curated tiles
        </h2>
        <p className="ds-section__lede">
          Each tile maps to a published entity primary image (GCS public-media). Rebuild the
          local pool with the collage tile script when the Commons promote set changes.
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
      </section>

      <p className="ds-sans ds-story-article__footer">
        <Link href="/stories">All stories</Link>
        {' · '}
        <Link href="/about">About</Link>
      </p>
    </main>
  );
}
