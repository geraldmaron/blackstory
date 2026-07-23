/**
 * About page — product thesis as a full-bleed living mosaic mast, then editorial
 * pillars, mission beats, one ink band, and destination paths. Composition-first:
 * brand hero, one job per section, archive atmosphere as the visual lead.
 */

import Link from 'next/link';
import { AboutMosaicMast } from '../../components/atmosphere/AboutMosaicRail';
import { MakerCredit } from '../../components/MakerCredit';

export const metadata = {
  title: 'About',
  description:
    'BlackStory is a place-connected Black history research platform. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
};

const PILLARS = [
  {
    kicker: 'Presence',
    title: 'Pinned to place',
    body: 'People, schools, institutions, and events stay on the ground, not a trauma-first feed, and not a remote museum shelf.',
  },
  {
    kicker: 'Evidence',
    title: 'Receipts on every claim',
    body: 'Accepted claims carry citations and confidence you can read. When sources disagree, both stay visible.',
  },
  {
    kicker: 'Dignity',
    title: 'Rules, not tone',
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

const DESTINATIONS = [
  {
    href: '/',
    label: 'Map',
    detail: 'Documented presence nationwide, then Explore for filters and place-first browsing.',
  },
  {
    href: '/search',
    label: 'Search',
    detail: 'Find people, places, and events by name or keyword.',
  },
  {
    href: '/history',
    label: 'History',
    detail: 'Follow connections across time and place.',
  },
  {
    href: '/data',
    label: 'Data',
    detail: 'National rollups from cited public statistics: census, ACS, related coverage.',
  },
  {
    href: '/law',
    label: 'Law',
    detail: 'Plain-language entry points to landmark civil-rights statutes and decisions.',
  },
  {
    href: '/submit',
    label: 'Submit',
    detail: 'Offer a lead for research consideration, not an instant public post.',
  },
] as const;

export default function AboutPage() {
  return (
    <main className="ds-about" id="main">
      <AboutMosaicMast>
        <p className="ds-page__eyebrow">BlackStory</p>
        <h1 className="ds-page__title">
          History, pinned to <em>place</em>.
        </h1>
        <p className="ds-page__lede">
          A place-connected Black history research platform, so documented history stays findable,
          especially the history close to you. People. Places. Evidence. Context.
        </p>
        <p className="ds-about-mast__actions">
          <Link className="ds-cta ds-cta--solid" href="/explore">
            Open the map
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Methodology
          </Link>
        </p>
      </AboutMosaicMast>

      <div className="ds-container ds-about__body">
        <section className="ds-about__pillars" aria-labelledby="about-pillars-heading">
          <header className="ds-about__pillars-intro">
            <p className="ds-section__kicker">What holds</p>
            <h2 className="ds-section__title ds-about__pillars-title" id="about-pillars-heading">
              Presence. Evidence. Dignity.
            </h2>
            <p className="ds-section__lede">
              Three commitments travel with every record: place first, receipts attached, and
              protections that are rules rather than tone.
            </p>
          </header>
          <ul className="ds-about__pillar-list" aria-label="What the archive stands on">
            {PILLARS.map((pillar, index) => (
              <li key={pillar.kicker} className="ds-about__pillar">
                <p className="ds-about__pillar-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <p className="ds-about__pillar-kicker">{pillar.kicker}</p>
                <h3 className="ds-about__pillar-title">{pillar.title}</h3>
                <p className="ds-about__pillar-body">{pillar.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="ds-about__beats" aria-labelledby="about-beats-heading">
          <h2 className="ds-visually-hidden" id="about-beats-heading">
            Why this exists
          </h2>
          <article className="ds-about__beat">
            <p className="ds-mono ds-about__beat-index">01</p>
            <h3 className="ds-about__beat-title">History should not be erased</h3>
            <p className="ds-about__beat-body">
              When sources disagree, both claims stay on the record. When a fact is corrected, the
              earlier wording remains visible. Withdrawals stay resolvable with a plain-language
              reason. Presence and proof travel together: scale on the map, receipts on every
              record.
            </p>
          </article>
          <article className="ds-about__beat">
            <p className="ds-mono ds-about__beat-index">02</p>
            <h3 className="ds-about__beat-title">It should not be hard to find</h3>
            <p className="ds-about__beat-body">
              Most people pass documented Black history without knowing it is there. Open the map,
              start with your state, search by name or place, or follow a decade of movement.
              Confidence stays readable in words and glyphs, never color alone, with a path to
              challenge what looks wrong.
            </p>
          </article>
          <article className="ds-about__beat">
            <p className="ds-mono ds-about__beat-index">03</p>
            <h3 className="ds-about__beat-title">Accessible because it is about you</h3>
            <p className="ds-about__beat-body">
              Not a remote museum shelf: history pinned to the places people live, teach, report
              from, and visit. Choose a state. Share your location if you want to. Read what
              happened around you with evidence attached and living people protected.
            </p>
          </article>
        </section>
      </div>

      <section className="ds-about__band" aria-labelledby="publish-heading">
        <div className="ds-container">
          <p className="ds-section__kicker">Publish bar</p>
          <h2 className="ds-section__title" id="publish-heading">
            Released projections only, with receipts
          </h2>
          <p className="ds-section__lede">
            Public pages show records that passed citation completeness, provenance checks, and
            living-person protections. Draft work stays off public surfaces. Maps never imply
            sharper location than the stored precision. The archive is incomplete by nature; gaps
            are stated plainly. Completeness is not claimed.
          </p>
          <p className="ds-about__band-cta">
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
      </section>

      <div className="ds-container ds-about__body">
        <section className="ds-about__destinations" aria-labelledby="do-heading">
          <p className="ds-section__kicker">On the site</p>
          <h2 className="ds-section__title" id="do-heading">
            Where to begin
          </h2>
          <ul className="ds-about__dest-list">
            {DESTINATIONS.map((item) => (
              <li key={item.href} className="ds-about__dest">
                <Link className="ds-about__dest-link" href={item.href}>
                  <span className="ds-about__dest-label">{item.label}</span>
                  <span className="ds-about__dest-detail">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ds-about__close" aria-labelledby="auth-heading">
          <h2 className="ds-about__close-title" id="auth-heading">
            No account required
          </h2>
          <p className="ds-about__close-body">
            Every public page works without authentication. Location sharing on the map is optional
            and under your control. Reading here does not require creating an identity with us.
          </p>
          <p className="ds-about-mast__actions">
            <Link className="ds-cta ds-cta--copper" href="/explore">
              Explore the map
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/stories">
              Read stories
            </Link>
          </p>
        </section>

        <MakerCredit variant="inline" className="ds-about__maker" />
      </div>
    </main>
  );
}
