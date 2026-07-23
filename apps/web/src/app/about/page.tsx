/**
 * About v6 edition page: product thesis as a Surface card stack on the shared
 * edition atmosphere (grain, grid, gutter mosaic). Mission copy preserved; layout
 * follows home/history edition vocabulary.
 */

import Link from 'next/link';
import { MakerCredit } from '../../components/MakerCredit';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { EditionAtmosphereMosaic } from '../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  EDITION_MOSAIC_COUNT_BROWSE,
} from '../../components/patterns/edition-atmosphere/edition-atmosphere-config';
import {
  ABOUT_DESTINATIONS,
  ABOUT_MISSION_BEATS,
  ABOUT_PILLARS,
} from './about-copy';
import {
  ABOUT_EDITION_MOSAIC_SEED,
  aboutEditionPanelClassName,
  aboutEditionRootClassName,
  aboutEditionStackClassName,
} from './about-panel-chrome';
import './about-edition.css';

export const metadata = {
  title: 'About',
  description:
    'BlackStory is a place-connected Black history research platform. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
};

export default function AboutPage() {
  return (
    <div className={aboutEditionRootClassName()} data-about-edition="v6">
      <EditionAtmosphereMosaic seedKey={ABOUT_EDITION_MOSAIC_SEED} count={EDITION_MOSAIC_COUNT_BROWSE} />
      <main className="ds-container ds-page" id="main">
        <div className={aboutEditionStackClassName()}>
          <article className={aboutEditionPanelClassName('intro')}>
            <header className="ds-about-edition__header">
              <span className="ds-about-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-about-edition__kicker">BlackStory</p>
                <h1 className="ds-about-edition__title">
                  History, pinned to <em>place</em>.
                </h1>
                <p className="ds-about-edition__lede">
                  A place-connected Black history research platform, so documented history stays
                  findable, especially the history close to you. People. Places. Evidence. Context.
                </p>
                <p className="ds-about-edition__actions">
                  <Link className="ds-cta ds-cta--solid" href="/explore">
                    Open the map
                  </Link>
                  <Link className="ds-cta ds-cta--quiet" href="/methodology">
                    Methodology
                  </Link>
                </p>
                <p className="ds-about-edition__credit">
                  Archive mosaic · symbolic atmosphere · decorative gutter tiles only.{' '}
                  <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
                </p>
              </div>
            </header>
          </article>

          <article
            className={aboutEditionPanelClassName('pillars')}
            aria-labelledby="about-pillars-heading"
          >
            <header className="ds-about-edition__header">
              <span className="ds-about-edition__index" aria-hidden="true">
                01
              </span>
              <div>
                <p className="ds-about-edition__kicker">What holds</p>
                <h2 className="ds-about-edition__title" id="about-pillars-heading">
                  Presence. Evidence. Dignity.
                </h2>
                <p className="ds-about-edition__lede">
                  Three commitments travel with every record: place first, receipts attached, and
                  protections that are rules rather than tone.
                </p>
              </div>
            </header>
            <ul className="ds-about-edition__pillar-list" aria-label="What the archive stands on">
              {ABOUT_PILLARS.map((pillar, index) => (
                <li key={pillar.kicker} className="ds-about-edition__pillar">
                  <p className="ds-about-edition__pillar-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className="ds-about-edition__pillar-kicker">{pillar.kicker}</p>
                  <h3 className="ds-about-edition__pillar-title">{pillar.title}</h3>
                  <p className="ds-about-edition__pillar-body">{pillar.body}</p>
                </li>
              ))}
            </ul>
          </article>

          <article
            className={aboutEditionPanelClassName('mission')}
            aria-labelledby="about-beats-heading"
          >
            <header className="ds-about-edition__header">
              <span className="ds-about-edition__index" aria-hidden="true">
                02
              </span>
              <div>
                <p className="ds-about-edition__kicker">Why this exists</p>
                <h2 className="ds-about-edition__title" id="about-beats-heading">
                  Mission beats
                </h2>
                <p className="ds-about-edition__lede">
                  Three reasons the archive stays public, place-first, and evidence-backed.
                </p>
              </div>
            </header>
            <ol className="ds-about-edition__mission-list">
              {ABOUT_MISSION_BEATS.map((beat) => (
                <li key={beat.index} className="ds-about-edition__mission">
                  <p className="ds-about-edition__mission-index" aria-hidden="true">
                    {beat.index}
                  </p>
                  <h3 className="ds-about-edition__mission-title">{beat.title}</h3>
                  <p className="ds-about-edition__mission-body">{beat.body}</p>
                </li>
              ))}
            </ol>
          </article>

          <article
            className={aboutEditionPanelClassName('publish')}
            aria-labelledby="publish-heading"
          >
            <header className="ds-about-edition__header">
              <span className="ds-about-edition__index" aria-hidden="true">
                03
              </span>
              <div>
                <p className="ds-about-edition__kicker">Publish bar</p>
                <h2 className="ds-about-edition__title" id="publish-heading">
                  Released projections only, with receipts
                </h2>
                <p className="ds-about-edition__lede">
                  Public pages show records that passed citation completeness, provenance checks, and
                  living-person protections. Draft work stays off public surfaces. Maps never imply
                  sharper location than the stored precision. The archive is incomplete by nature;
                  gaps are stated plainly. Completeness is not claimed.
                </p>
                <p className="ds-about-edition__actions">
                  <Link className="ds-cta ds-cta--solid" href="/methodology">
                    Read the methodology
                  </Link>
                  <Link className="ds-cta ds-cta--quiet" href="/corrections">
                    Corrections
                  </Link>
                  <Link className="ds-cta ds-cta--quiet" href="/errata">
                    Errata
                  </Link>
                </p>
              </div>
            </header>
          </article>

          <article
            className={aboutEditionPanelClassName('destinations')}
            aria-labelledby="do-heading"
          >
            <header className="ds-about-edition__header">
              <span className="ds-about-edition__index" aria-hidden="true">
                04
              </span>
              <div>
                <p className="ds-about-edition__kicker">On the site</p>
                <h2 className="ds-about-edition__title" id="do-heading">
                  Where to begin
                </h2>
              </div>
            </header>
            <ul className="ds-about-edition__dest-list">
              {ABOUT_DESTINATIONS.map((item) => (
                <li key={`${item.href}-${item.label}`} className="ds-about-edition__dest">
                  <Link className="ds-about-edition__dest-link" href={item.href}>
                    <span className="ds-about-edition__dest-label">{item.label}</span>
                    <span className="ds-about-edition__dest-detail">{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>

          <article className={aboutEditionPanelClassName('close')} aria-labelledby="auth-heading">
            <h2 className="ds-about-edition__panel-heading" id="auth-heading">
              No account required
            </h2>
            <p className="ds-about-edition__close-body">
              Every public page works without authentication. Location sharing on the map is optional
              and under your control. Reading here does not require creating an identity with us.
            </p>
            <p className="ds-about-edition__actions">
              <Link className="ds-cta ds-cta--copper" href="/explore">
                Explore the map
              </Link>
              <Link className="ds-cta ds-cta--quiet" href="/stories">
                Read stories
              </Link>
            </p>
          </article>

          <MakerCredit variant="inline" className="ds-about-edition__maker" />
        </div>
      </main>
    </div>
  );
}
