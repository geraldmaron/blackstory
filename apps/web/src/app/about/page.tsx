/**
 * `/about` — the product thesis and publish ethics of the archive.
 *
 * Rendered through the v9 room kit for design parity with every other room.
 * Prose, structure, and all user-facing copy are preserved from the v6 edition;
 * chrome and layout are replaced by kit components to retire per-route edition styles.
 */

import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { MakerCredit } from '../../components/MakerCredit';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { ABOUT_DESTINATIONS, ABOUT_MISSION_BEATS, ABOUT_PILLARS } from './about-copy';
import { GroupHeading, OffRamp, Prose, Room, RoomHeader } from '../../components/room';
import '../reading-room.css';
import './about-page.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/about',
  title: 'About',
  description:
    'BlackStory is a place-connected Black history research platform. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
});

export default function AboutPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/about"
        kicker="BlackStory"
        title="History, pinned to <em>place</em>."
        lede="A place-connected Black history research platform, so documented history stays findable, especially the history close to you. People. Places. Evidence. Context."
        showPath={false}
      />

      <Prose>
        <div className="ds-about-page__intro-actions">
          <Link className="ds-cta ds-cta--solid" href="/">
            Open the map
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Methodology
          </Link>
        </div>
        <p className="ds-about-page__mosaic-credit">
          Archive texture · symbolic atmosphere.{' '}
          <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
        </p>
      </Prose>

      <section className="ds-about-page__pillars" aria-labelledby="pillars-heading">
        <GroupHeading>
          <span id="pillars-heading">Presence. Evidence. Dignity.</span>
        </GroupHeading>
        <Prose>
          <p>
            Three commitments travel with every record: place first, receipts attached, and
            protections that are rules rather than tone.
          </p>
        </Prose>
        <ul className="ds-about-page__pillar-list" aria-label="What the archive stands on">
          {ABOUT_PILLARS.map((pillar, index) => (
            <li key={pillar.kicker} className="ds-about-page__pillar">
              <p className="ds-about-page__pillar-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="ds-about-page__pillar-kicker">{pillar.kicker}</p>
              <h3 className="ds-about-page__pillar-title">{pillar.title}</h3>
              <p className="ds-about-page__pillar-body">{pillar.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="ds-about-page__mission" aria-labelledby="beats-heading">
        <GroupHeading>
          <span id="beats-heading">Mission beats</span>
        </GroupHeading>
        <Prose>
          <p>Three reasons the archive stays public, place-first, and evidence-backed.</p>
        </Prose>
        <ol className="ds-about-page__mission-list">
          {ABOUT_MISSION_BEATS.map((beat) => (
            <li key={beat.index} className="ds-about-page__mission-item">
              <p className="ds-about-page__mission-index" aria-hidden="true">
                {beat.index}
              </p>
              <h3 className="ds-about-page__mission-title">{beat.title}</h3>
              <p className="ds-about-page__mission-body">{beat.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ds-about-page__publish" aria-labelledby="publish-heading">
        <GroupHeading>
          <span id="publish-heading">Released projections only, with receipts</span>
        </GroupHeading>
        <Prose>
          <p>
            Public pages show records that passed citation completeness, provenance checks, and
            living-person protections. Draft work stays off public surfaces. Maps never imply
            sharper location than the stored precision. The archive is incomplete by nature; gaps
            are stated plainly. Completeness is not claimed.
          </p>
          <div className="ds-about-page__publish-actions">
            <Link className="ds-cta ds-cta--solid" href="/methodology">
              Read the methodology
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/corrections">
              Corrections
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/errata">
              Errata
            </Link>
          </div>
        </Prose>
      </section>

      <section className="ds-about-page__destinations" aria-labelledby="destinations-heading">
        <GroupHeading>
          <span id="destinations-heading">Where to begin</span>
        </GroupHeading>
        <ul className="ds-about-page__dest-list">
          {ABOUT_DESTINATIONS.map((item) => (
            <li key={`${item.href}-${item.label}`} className="ds-about-page__dest">
              <Link className="ds-about-page__dest-link" href={item.href}>
                <span className="ds-about-page__dest-label">{item.label}</span>
                <span className="ds-about-page__dest-detail">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <OffRamp
        title="No account required"
        actions={[
          { label: 'Explore the map', href: '/', emphasis: 'copper' },
          { label: 'Read chapters', href: '/chapters' },
        ]}
      >
        Every public page works without authentication. Location sharing on the map is optional and
        under your control. Reading here does not require creating an identity with us.
      </OffRamp>

      <div className="ds-about-page__maker">
        <MakerCredit variant="inline" />
      </div>
    </Room>
  );
}
