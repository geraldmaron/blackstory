/**
 * About body sections — composed into `/apparatus#about` and formerly the `/about` room.
 * No ReadingEntry here; the parent room owns the mast.
 */
import React from 'react';
import Link from 'next/link';
import { MakerCredit } from '../../components/MakerCredit';
import { WalkOffRamp } from '../walk-off-ramp';
import {
  cardTitleFor,
  destinationsInGroup,
  type Destination,
} from '../../lib/nav/destination-registry';
import {
  ABOUT_CONTRIBUTE,
  ABOUT_NEO,
  ABOUT_ORIGIN,
  ABOUT_PILLARS,
  ABOUT_REFUSALS,
} from './about-copy';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import { CardGrid, GroupHeading, MapMoment, Prose, RoomCard } from '../../components/room';
import './about-page.css';

void React;

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

export function AboutSections() {
  const readRooms = destinationsInGroup('read');
  const checkRooms = destinationsInGroup('check').filter(
    (destination) => destination.path !== '/about' && destination.path !== '/apparatus',
  );
  const takePartRooms = destinationsInGroup('take-part');

  return (
    <>
      <Prose>
        {ABOUT_ORIGIN.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </Prose>

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
            How each of those is decided, and what the evidence grades mean, is set out in{' '}
            <Link href="/apparatus?s=methodology">methodology</Link>. Everything the archive has
            already gotten wrong and fixed is in the <Link href="/errata">errata</Link>.
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
    </>
  );
}
