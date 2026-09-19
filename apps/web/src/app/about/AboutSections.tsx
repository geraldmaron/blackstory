/**
 * About body sections — composed into the `/about` room.
 * No ReadingEntry here; the parent room owns the mast.
 */
import React from 'react';
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
  ABOUT_STANCE,
  ABOUT_ROOMS_HANDOFF,
  ABOUT_SOURCE_LIBRARY_HANDOFF,
} from './about-copy';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import {
  CardGrid,
  MapMoment,
  Prose,
  RoomCard,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
  roomSectionTone,
} from '../../components/room';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import './about-page.css';

void React;

function destinationCard(destination: Destination) {
  return (
    <RoomCard
      key={destination.path}
      href={destination.path}
      kind={destination.kind ?? 'ROOM'}
      title={
        <>
          <DestinationIcon id={destination.icon} size="md" />
          {cardTitleFor(destination)}
        </>
      }
      {...(destination.description === undefined ? {} : { description: destination.description })}
    />
  );
}

const ABOUT_JUMP = [
  { id: 'origin', label: 'Why this exists', icon: 'about' as const },
  { id: 'stance', label: 'How I mean this', icon: 'evidence' as const },
  { id: 'pillars', label: 'What records stand on', icon: 'evidence' as const },
  { id: 'neo', label: 'How writing is made', icon: 'publication' as const },
  { id: 'refusals', label: 'What it will not do', icon: 'errata' as const },
  { id: 'contribute', label: 'Add to it', icon: 'submit' as const },
  { id: 'begin', label: 'Where to begin', icon: 'rooms' as const },
] as const;

export function AboutSections() {
  const takePartRooms = destinationsInGroup('take-part');

  return (
    <>
      <RoomJump sections={ABOUT_JUMP} />

      <RoomSection
        id="origin"
        icon="about"
        kicker="Origin"
        title="Why this exists"
        tone={roomSectionTone(0)}
      >
        <Prose>
          {ABOUT_ORIGIN.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </Prose>
      </RoomSection>

      <RoomSection
        id="stance"
        icon="evidence"
        kicker="Reading"
        title={ABOUT_STANCE.heading}
        tone={roomSectionTone(1)}
      >
        <Prose>
          {ABOUT_STANCE.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <p>
            {ABOUT_STANCE.maker.lead}{' '}
            <a href={ABOUT_STANCE.maker.href} rel="noopener noreferrer">
              {ABOUT_STANCE.maker.label}
            </a>
            .
          </p>
        </Prose>
      </RoomSection>

      <MapMoment
        camera={{ center: [-96.5, 38.6], zoom: 3.4 }}
        note="Records sit in every region of the country. That is a claim the archive has to keep county by county rather than assert once."
      />

      <RoomSection
        id="pillars"
        icon="evidence"
        kicker="Rules"
        title="What every record stands on"
        tone={roomSectionTone(2)}
      >
        <Prose>
          <p>
            Four rules travel with every record. They are enforced where the record is built, so you
            can check each one on any record page instead of taking it on faith.
          </p>
        </Prose>
        <RoomFactList
          items={ABOUT_PILLARS.map((pillar) => ({
            title: pillar.title,
            body: pillar.body,
            icon: pillar.icon,
            kicker: pillar.kicker,
          }))}
        />
        <RoomHandoff
          href={ABOUT_SOURCE_LIBRARY_HANDOFF.href}
          icon="source"
          title={ABOUT_SOURCE_LIBRARY_HANDOFF.label}
          line="The publishers the archive cites, and how a URL becomes a citation on a record."
        />
      </RoomSection>

      <RoomSection
        id="neo"
        icon="publication"
        kicker="Voice"
        title={ABOUT_NEO.heading}
        tone={roomSectionTone(3)}
      >
        <Prose>
          {ABOUT_NEO.rules.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          {ABOUT_NEO.human.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <p>{ABOUT_NEO.hand}</p>
        </Prose>
      </RoomSection>

      <RoomSection
        id="refusals"
        icon="errata"
        kicker="Limits"
        title="What it will not do"
        tone={roomSectionTone(4)}
      >
        <ul className="ds-about-page__refusals">
          {ABOUT_REFUSALS.map((refusal) => (
            <li key={refusal.slice(0, 40)} className="ds-about-page__refusal">
              {refusal}
            </li>
          ))}
        </ul>
        <div className="ds-room-handoffs">
          <RoomHandoff
            href="/methodology"
            icon="methodology"
            title="Methodology"
            line="How each of those is decided, and what the evidence grades mean."
          />
          <RoomHandoff
            href="/errata"
            icon="errata"
            title="Errata"
            line="Everything the archive has already gotten wrong and fixed."
          />
        </div>
      </RoomSection>

      <RoomSection
        id="contribute"
        icon="submit"
        kicker="Take part"
        title={ABOUT_CONTRIBUTE.heading}
        tone={roomSectionTone(5)}
      >
        <Prose>
          <p>{ABOUT_CONTRIBUTE.lede}</p>
          <p>{ABOUT_CONTRIBUTE.terms}</p>
          <p>
            {ABOUT_CONTRIBUTE.direct} <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>
          </p>
        </Prose>
        <CardGrid>{takePartRooms.map(destinationCard)}</CardGrid>
      </RoomSection>

      <RoomSection
        id="begin"
        icon="rooms"
        kicker="Start"
        title="Where to begin"
        tone={roomSectionTone(6)}
      >
        <Prose>
          <p>{ABOUT_ROOMS_HANDOFF.lede}</p>
        </Prose>
        <RoomHandoff
          href={ABOUT_ROOMS_HANDOFF.href}
          icon="rooms"
          title={ABOUT_ROOMS_HANDOFF.label}
          line="The catalogue of rooms. If a room is not on that list, it is not finished."
        />
      </RoomSection>

      <WalkOffRamp title="No account required">
        Every public page works without signing in. Nothing here asks you to make an account or say
        who you are before you can read it.
      </WalkOffRamp>

      <div className="ds-about-page__foot">
        <MakerCredit variant="inline" />
      </div>
    </>
  );
}
