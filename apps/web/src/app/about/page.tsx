/**
 * `/about` — what this is, who made it, and how to take part.
 *
 * Rendered through the v9 room kit. The page has one job: explain the project honestly enough
 * that a stranger can decide whether to trust it and whether to contribute to it.
 *
 * TWO VOICES, ON PURPOSE. The origin section is first person, because a single maker with
 * ordinary tools is the true description of this archive and pretending otherwise would be the
 * first thing on the page a reader could catch it out on. Pillars and refusals are impersonal,
 * because those are rules the code enforces, not intentions the author holds.
 *
 * NO NUMBERED MARKERS. The previous version numbered the pillars 01/02/03 and the mission beats
 * likewise. Neither list is a sequence: the three commitments hold simultaneously, and numbering
 * them implied an order and a hierarchy that does not exist.
 *
 * DESTINATIONS ARE GENERATED. Both card grids read `destination-registry.ts`. This is the
 * adoption gate the surface doc asks for: a room absent from the registry is absent from the
 * palette, the footer and this page at once, and cannot be quietly half-shipped.
 */

import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { MakerCredit } from '../../components/MakerCredit';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import {
  cardTitleFor,
  destinationsInGroup,
  type Destination,
} from '../../lib/nav/destination-registry';
import { ABOUT_CONTRIBUTE, ABOUT_ORIGIN, ABOUT_PILLARS, ABOUT_REFUSALS } from './about-copy';
import {
  CardGrid,
  GroupHeading,
  MapMoment,
  OffRamp,
  Prose,
  Room,
  RoomCard,
  RoomHeader,
} from '../../components/room';
import '../reading-room.css';
import './about-page.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/about',
  title: 'About',
  description:
    'BlackStory is a place-connected Black history archive, built by one person so documented history stays findable, and kept open so other people can add to it.',
});

/** A registry entry as a card. The kind comes from the registry, never retyped. */
function destinationCard(destination: Destination) {
  return (
    <RoomCard
      key={destination.path}
      href={destination.path}
      kind={destination.kind ?? 'ROOM'}
      title={cardTitleFor(destination)}
      {...(destination.description === undefined ? {} : { description: destination.description })}
    />
  );
}

export default function AboutPage() {
  // `/about` is itself in the `check` group; a room does not list itself as somewhere to go.
  const readRooms = destinationsInGroup('read');
  const checkRooms = destinationsInGroup('check').filter(
    (destination) => destination.path !== '/about',
  );
  const takePartRooms = destinationsInGroup('take-part');

  return (
    <Room>
      <RoomHeader
        pathname="/about"
        kicker="Why this exists"
        title={
          <>
            Doing my part, and making room for <em>yours</em>.
          </>
        }
        lede="BlackStory is a place-connected archive of Black history: people, places, and events pinned to where they happened, with the source attached to every claim. I built it with the tools and records available to me, and it is unfinished on purpose."
        showPath={false}
      />

      <Prose>
        {ABOUT_ORIGIN.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </Prose>

      {/* The establishing shot, taken straight from the mock's /about room. It sits here rather
          than at the top because the claim it illustrates — that this is national, and held county
          by county — is the one the paragraphs above just finished making. */}
      <MapMoment
        camera={{ center: [-96.5, 38.6], zoom: 3.4 }}
        note="Records sit in every region of the country. That is a claim this archive has to keep county by county rather than assert once, so the map is the evidence for it and not an illustration of it."
        atlasHref="/"
      />

      <section className="ds-about-page__section" aria-labelledby="pillars-heading">
        <GroupHeading>
          <span id="pillars-heading">What every record stands on</span>
        </GroupHeading>
        <Prose>
          <p>
            Three commitments travel with every record: place first, receipts attached, and
            protections that are rules in the code rather than a tone in the writing.
          </p>
        </Prose>
        <ul className="ds-about-page__pillars" aria-label="What every record stands on">
          {ABOUT_PILLARS.map((pillar) => (
            <li key={pillar.kicker} className="ds-about-page__pillar">
              <p className="ds-about-page__pillar-kicker">{pillar.kicker}</p>
              <h3 className="ds-about-page__pillar-title">{pillar.title}</h3>
              <p className="ds-about-page__pillar-body">{pillar.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="ds-about-page__section" aria-labelledby="refusals-heading">
        <GroupHeading>
          <span id="refusals-heading">What it will not do</span>
        </GroupHeading>
        <ul className="ds-about-page__refusals">
          {ABOUT_REFUSALS.map((refusal) => (
            <li key={refusal.slice(0, 40)} className="ds-about-page__refusal">
              {refusal}
            </li>
          ))}
        </ul>
        <Prose>
          <p>
            How each of those is decided, and what the evidence grades mean, is set out in the{' '}
            <Link href="/methodology">methodology</Link>. Everything the archive has already gotten
            wrong and fixed is in the <Link href="/errata">errata</Link>.
          </p>
        </Prose>
      </section>

      <section className="ds-about-page__section" aria-labelledby="contribute-heading">
        <GroupHeading>
          <span id="contribute-heading">{ABOUT_CONTRIBUTE.heading}</span>
        </GroupHeading>
        <Prose>
          <p>{ABOUT_CONTRIBUTE.lede}</p>
          <p>{ABOUT_CONTRIBUTE.terms}</p>
        </Prose>
        <CardGrid>{takePartRooms.map(destinationCard)}</CardGrid>
      </section>

      <section className="ds-about-page__section" aria-labelledby="begin-heading">
        <GroupHeading>
          <span id="begin-heading">Where to begin</span>
        </GroupHeading>
        <Prose>
          <p>
            Every room the archive publishes, and what each one is for. If a room is not on this
            list, it is not finished.
          </p>
        </Prose>
        <CardGrid>{[...readRooms, ...checkRooms].map(destinationCard)}</CardGrid>
      </section>

      <OffRamp
        title="No account required"
        actions={[
          { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
          { label: 'Search the records', href: '/records' },
          { label: 'Submit a lead', href: '/submit' },
        ]}
      >
        Every public page works without signing in. Sharing your location on the map is optional and
        under your control. Reading here does not require creating an identity with us.
      </OffRamp>

      <div className="ds-about-page__foot">
        <p className="ds-about-page__credit">
          Archive texture, symbolic atmosphere.{' '}
          <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
        </p>
        <MakerCredit variant="inline" />
      </div>
    </Room>
  );
}
