/**
 * Server-rendered front door: one released place (and optional story), not the Atlas board.
 *
 * Voice is stolen from `/about` and `/stories`, not invented. Room kit only. The map is an
 * OffRamp, not the boot. First paint does not advertise a confidence grade or source count:
 * a count of citations is not two lineages.
 */
import React from 'react';
import Link from 'next/link';
import { mapToneFromTopics } from '../lib/map-experience/kind-encoding';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import { ATLAS_INSTRUMENT_HREF } from '../lib/nav/atlas-door';
import { destinationFor } from '../lib/nav/destination-registry';
import {
  CardGrid,
  GroupHeading,
  OffRamp,
  Prose,
  Room,
  RoomCard,
  RoomHeader,
} from '../components/room';
import {
  RecordAnatomyPanel,
  type RecordAnatomyFact,
} from '../components/patterns/RecordAnatomyPanel';
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
} from './entity/[id]/entity-anatomy-facts';
import { ABOUT_LINE, ABOUT_PILLARS } from './about/about-copy';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import './reading-room.css';

const PINNED_TO_PLACE = ABOUT_PILLARS[0]?.title ?? 'Pinned to place';
const STORIES_ROOM = destinationFor('/stories');
const STORIES_ARGUED =
  STORIES_ROOM?.description?.split('.')[0] ?? 'The archive argued rather than listed';

function anatomyFacts(
  inputs: ReturnType<typeof buildEntityAnatomyInputs>,
): readonly RecordAnatomyFact[] {
  return [
    {
      key: 'kind',
      label: 'Kind',
      value: inputs.kindLabel,
      icon: { variant: 'record-kind', kind: inputs.kind, muted: true },
    },
    {
      key: 'where',
      label: 'Where',
      value: inputs.whereLabel,
      icon: { variant: 'record-where' },
    },
    {
      key: 'era',
      label: 'Era',
      value: inputs.eraLabel,
      icon: { variant: 'record-era' },
    },
  ];
}

export function HomeFirstPaint({ model }: { readonly model: HomeFirstPaintModel }) {
  const lead =
    model.lead && !isInternalRecordLabel(model.lead.displayName) ? model.lead : undefined;
  const story = model.story && !isInternalRecordLabel(model.story.title) ? model.story : undefined;
  const mapTone = lead ? mapToneFromTopics(lead.topicIds ?? lead.topicTags) : undefined;
  const anatomyInputs = lead ? buildEntityAnatomyInputs(lead, mapTone) : undefined;
  const geo = lead ? (lead.geoAnchor ?? geoAnchorFor(lead.id)) : undefined;
  const place = lead && anatomyInputs ? buildEntityAnatomyPlace(lead, geo) : undefined;
  const title = lead?.displayName ?? story?.title ?? PINNED_TO_PLACE;
  const also = model.also.filter((entity) => !isInternalRecordLabel(entity.displayName));
  const showStoryCard = Boolean(story && lead);

  return (
    <Room className="ds-home-first-paint">
      <RoomHeader
        pathname="/"
        crumbLabel="Home"
        kicker={PINNED_TO_PLACE}
        title={title}
        lede={ABOUT_LINE}
        {...(lead && anatomyInputs
          ? {
              meta: [anatomyInputs.kindLabel, anatomyInputs.whereLabel, anatomyInputs.eraLabel],
            }
          : story
            ? {
                meta: [
                  story.kind === 'article' ? 'Entry' : 'Chapter',
                  story.placeLabel,
                  story.eraLabel,
                ],
              }
            : {})}
        showPath={false}
      />

      {lead && anatomyInputs ? (
        <>
          <RecordAnatomyPanel
            facts={anatomyFacts(anatomyInputs)}
            {...(place ? { place } : {})}
            aria-label={`${lead.displayName} at a glance`}
          />
          <Prose>
            <p>{lead.summary}</p>
            <p>{lead.historicalContext}</p>
          </Prose>
          <p>
            <Link className="ds-cta ds-cta--copper" href={`/entity/${lead.id}`}>
              Open this record
            </Link>
          </p>
        </>
      ) : null}

      {!lead && story ? (
        <>
          <Prose>
            <p>{story.summary}</p>
          </Prose>
          <p>
            <Link className="ds-cta ds-cta--copper" href={`/stories/${story.slug}`}>
              {story.kind === 'article' ? 'Read the entry' : 'Read the chapter'}
            </Link>
          </p>
        </>
      ) : null}

      {also.length > 0 || showStoryCard ? (
        <>
          <GroupHeading>{STORIES_ARGUED}</GroupHeading>
          <CardGrid>
            {also.map((entity) => (
              <RoomCard
                key={entity.id}
                href={`/entity/${entity.id}`}
                kind={entity.kind}
                title={entity.displayName}
                description={entity.summary}
                meta={`${entity.jurisdictionLabel} · ${entity.era}`}
              />
            ))}
            {showStoryCard && story ? (
              <RoomCard
                href={`/stories/${story.slug}`}
                kind={story.kind === 'article' ? 'Entry' : 'Chapter'}
                title={story.title}
                description={story.summary}
                meta={[story.eraLabel, story.placeLabel].filter(Boolean).join(' · ')}
                tag={story.kind === 'article' ? 'Entry' : 'Chapter'}
              />
            ) : null}
          </CardGrid>
        </>
      ) : null}

      <OffRamp
        title="Where to begin"
        actions={[
          {
            href: ATLAS_INSTRUMENT_HREF,
            label: 'Open the Atlas',
            ...(lead ? {} : { emphasis: 'copper' as const }),
          },
          { href: '/records', label: 'Search the records' },
          { href: '/stories', label: 'Stories' },
        ]}
      >
        The Atlas answers where and when.
      </OffRamp>
    </Room>
  );
}
