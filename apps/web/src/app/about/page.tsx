/**
 * `/about` — what this is, who made it, and how to take part.
 *
 * Rendered through the v9 room kit. The page has one job: explain the project honestly enough
 * that a stranger can decide whether to trust it and whether to contribute to it.
 *
 * TWO VOICES, ON PURPOSE. The origin section, the human half of "How the writing is made", and
 * the invitation to contribute are first person, because a single maker with ordinary tools is the
 * true description of this archive and pretending otherwise would be the first thing on the page a
 * reader could catch it out on. Pillars, refusals and the procedure half of the writing section are
 * impersonal, because those are rules the code enforces rather than intentions the author holds.
 * There is no "we" on this page, in either voice.
 *
 * THE WRITING SECTION IS A DISCLOSURE. It says that the long-form prose is drafted with AI, what
 * reviews it after, and what the voice is not allowed to do. Every sentence in it is checkable
 * against `docs/content/neo-voice.md`, `docs/methodology/chapter-fact-validation.md`, the two
 * review skills under `.claude/skills/blackstory/`, the gates in
 * `packages/ops-data/scripts/articles.ts`, and `brand/cover-lock/v1/README.md`. Adding a step that
 * is not in those files would make this section the least trustworthy thing on the site.
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
import { WalkOffRamp } from '../walk-off-ramp';
import {
  cardTitleFor,
  destinationsInGroup,
  type Destination,
} from '../../lib/nav/destination-registry';
import {
  ABOUT_CONTRIBUTE,
  ABOUT_LEDE,
  ABOUT_NEO,
  ABOUT_ORIGIN,
  ABOUT_PILLARS,
  ABOUT_REFUSALS,
} from './about-copy';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import {
  CardGrid,
  GroupHeading,
  MapMoment,
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
        lede={ABOUT_LEDE}
        showPath={false}
      />

      <Prose>
        {ABOUT_ORIGIN.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </Prose>

      {/* The establishing shot, taken straight from the mock's /about room. It sits here rather
          than at the top because the claim it illustrates (that this is national, and held county
          by county) is the one the paragraphs above just finished making. */}
      <MapMoment
        camera={{ center: [-96.5, 38.6], zoom: 3.4 }}
        note="Records sit in every region of the country. That is a claim the archive has to keep county by county rather than assert once."
      />

      <section className="ds-about-page__section" aria-labelledby="pillars-heading">
        <GroupHeading>
          <span id="pillars-heading">What every record stands on</span>
        </GroupHeading>
        <Prose>
          <p>
            Four rules travel with every record. They are enforced where the record is built, so you
            can check each one on any record page instead of taking it on faith.
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

      <section className="ds-about-page__section" aria-labelledby="neo-heading">
        <GroupHeading>
          <span id="neo-heading">{ABOUT_NEO.heading}</span>
        </GroupHeading>
        <Prose>
          {ABOUT_NEO.rules.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          {ABOUT_NEO.human.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <p>{ABOUT_NEO.hand}</p>
        </Prose>
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
          <p>
            {ABOUT_CONTRIBUTE.direct} <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>
          </p>
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

      <WalkOffRamp
        title="No account required"
        extra={[{ label: 'Submit a lead', href: '/submit' }]}
      >
        Every public page works without signing in. Nothing here asks you to make an account or say
        who you are before you can read it.
      </WalkOffRamp>

      <div className="ds-about-page__foot">
        <MakerCredit variant="inline" />
      </div>
    </Room>
  );
}
