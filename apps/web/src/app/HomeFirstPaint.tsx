/**
 * Server-rendered front door: one released place (and optional story), not the Atlas board.
 *
 * Room kit only. The map is an OffRamp, not the boot. Binding voice: docs/ui/story.md.
 */
import Link from 'next/link';
import { mapToneFromTopics } from '../lib/map-experience/kind-encoding';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import { ATLAS_INSTRUMENT_HREF } from '../lib/nav/atlas-door';
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
import type { HomeFirstPaintModel } from './home-first-paint';
import './reading-room.css';

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
    {
      key: 'evidence',
      label: 'Evidence',
      value: inputs.evidenceLabel,
      icon: { variant: 'record-evidence', tier: inputs.evidenceTier },
    },
  ];
}

export function HomeFirstPaint({ model }: { readonly model: HomeFirstPaintModel }) {
  const lead = model.lead;
  const mapTone = lead ? mapToneFromTopics(lead.topicIds ?? lead.topicTags) : undefined;
  const anatomyInputs = lead ? buildEntityAnatomyInputs(lead, mapTone) : undefined;
  const geo = lead ? (lead.geoAnchor ?? geoAnchorFor(lead.id)) : undefined;
  const place = lead && anatomyInputs ? buildEntityAnatomyPlace(lead, geo) : undefined;

  return (
    <Room className="ds-home-first-paint">
      <RoomHeader
        pathname="/"
        crumbLabel="Home"
        kicker="History, pinned to place"
        title={
          <>
            History happened <em>here</em>.
          </>
        }
        lede={
          lead
            ? lead.summary
            : 'A regular person should be able to find what happened here. The archive opens on a place, not on a count of every record.'
        }
        {...(lead && anatomyInputs
          ? {
              meta: [anatomyInputs.kindLabel, anatomyInputs.whereLabel, anatomyInputs.eraLabel],
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
            <h2>{lead.displayName}</h2>
            <p>{lead.historicalContext}</p>
          </Prose>
          <p>
            <Link className="ds-cta ds-cta--copper" href={`/entity/${lead.id}`}>
              Open this record
            </Link>
          </p>
        </>
      ) : null}

      {model.also.length > 0 || model.story ? (
        <>
          <GroupHeading>Also here</GroupHeading>
          <CardGrid>
            {model.also.map((entity) => (
              <RoomCard
                key={entity.id}
                href={`/entity/${entity.id}`}
                kind={entity.kind}
                title={entity.displayName}
                description={entity.summary}
                meta={`${entity.jurisdictionLabel} · ${entity.era}`}
              />
            ))}
            {model.story ? (
              <RoomCard
                href={`/stories/${model.story.slug}`}
                kind={model.story.kind === 'article' ? 'Entry' : 'Chapter'}
                title={model.story.title}
                description={model.story.summary}
                meta={[model.story.eraLabel, model.story.placeLabel].filter(Boolean).join(' · ')}
                tag={model.story.kind === 'article' ? 'Entry' : 'Chapter'}
              />
            ) : null}
          </CardGrid>
        </>
      ) : null}

      <OffRamp
        title="Find what happened near you"
        actions={[
          {
            href: ATLAS_INSTRUMENT_HREF,
            label: 'Open the map',
            ...(lead ? {} : { emphasis: 'copper' as const }),
          },
          { href: '/records', label: 'Browse every record' },
          { href: '/stories', label: 'Read stories' },
        ]}
      >
        The map holds every pinned record. Open it when you want the whole archive, or stay with
        this place.
      </OffRamp>
    </Room>
  );
}
