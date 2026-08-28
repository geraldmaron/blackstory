/**
 * Server-rendered front door: one published place's record, using the existing record room.
 *
 * Not a manifesto, not a schema card, and not the Atlas board. The place is whoever
 * can be stood at (named slug, last stand, then a published record). Greenwood is
 * last-resort fallback only. Archive chrome (Law, Data, Memorial, Methodology,
 * Errata) is the same on every place. Stories exists only when this record
 * already names a chapter. No schema strip, no confidence badge, no precision
 * leak, no second record page.
 */
import React from 'react';
import Link from 'next/link';
import { EntityMastMedia } from '../components/entity/EntityMastMedia';
import { EntitySensitivityBanner } from '../components/entity/EntitySensitivityBanner';
import { LinkedProse, type EntityLinkCatalogEntry } from '../components/entity/LinkedProse';
import { RecordPlacePreview } from '../components/patterns/RecordPlacePreview';
import { Connections, OffRamp, Room } from '../components/room';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import type { PublicEntityView } from '../data/public-seed';
import { EntityRoomSections } from './entity/[id]/EntityRoomSections';
import { placeHref } from '../lib/place/public-place-path';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import {
  firstPaintEraLine,
  firstPaintRecord,
  publishableCitingStories,
  selectDoorRooms,
} from './home-first-paint-surface';
import '../components/entity/entity-page.css';
import './record-page.css';
import './entity/[id]/record-room.css';
import './home-first-paint.css';

void React;

function neighborCatalog(entity: PublicEntityView): readonly EntityLinkCatalogEntry[] {
  const seen = new Set<string>();
  const catalog: EntityLinkCatalogEntry[] = [];
  for (const neighbor of [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])]) {
    if (seen.has(neighbor.id) || neighbor.displayName.trim().length === 0) continue;
    if (isInternalRecordLabel(neighbor.displayName)) continue;
    seen.add(neighbor.id);
    catalog.push({ id: neighbor.id, displayName: neighbor.displayName });
  }
  return catalog;
}

function DoorRooms({ rooms }: { readonly rooms: ReturnType<typeof selectDoorRooms> }) {
  if (rooms.length === 0) return null;
  const actions = rooms.map((room, index) => ({
    href: room.href,
    label: room.label,
    ...(index === 0 ? { emphasis: 'copper' as const } : {}),
  }));
  const names = rooms.map((room) => room.label).join(', ');
  return (
    <OffRamp title={names} actions={actions}>
      Open a room from this place, then come back.
    </OffRamp>
  );
}

export function HomeFirstPaint({ model }: { readonly model: HomeFirstPaintModel }) {
  const rawLead =
    model.lead && !isInternalRecordLabel(model.lead.displayName) ? model.lead : undefined;
  const story = model.story && !isInternalRecordLabel(model.story.title) ? model.story : undefined;

  if (rawLead) {
    const lead = firstPaintRecord(rawLead);
    const catalog = neighborCatalog(lead);
    const geo = lead.geoAnchor ?? geoAnchorFor(lead.id);
    const citing = publishableCitingStories(model.citing);
    const rooms = selectDoorRooms(lead, citing);
    const eraLine = firstPaintEraLine(lead);

    return (
      <Room
        className="ds-home-first-paint"
        masthead={
          <figure
            className="ds-record-mast"
            data-media={lead.primaryImage !== undefined ? 'photo' : 'mark'}
          >
            <EntityMastMedia
              entityId={lead.id}
              entityName={lead.displayName}
              {...(lead.primaryImage !== undefined ? { primaryImage: lead.primaryImage } : {})}
              hideCredit
              priority
            />
            <figcaption className="ds-record-mast__over">
              <h1 className="ds-record-mast__title">{lead.displayName}</h1>
              <p className="ds-record-mast__lede">
                <LinkedProse
                  as="span"
                  text={lead.summary}
                  skipEntityIds={[lead.id]}
                  catalog={catalog}
                  hrefFor={(entry) => placeHref(entry.label)}
                />
              </p>
            </figcaption>
          </figure>
        }
      >
        {geo ? (
          <section className="ds-home-place-stand" aria-label={lead.locationLabel}>
            <RecordPlacePreview lat={geo.lat} lng={geo.lng} label={lead.locationLabel} />
          </section>
        ) : null}

        {eraLine ? <p>{eraLine}</p> : null}

        {lead.sensitivity ? (
          <EntitySensitivityBanner sensitivity={lead.sensitivity} entityKind={lead.kind} />
        ) : null}

        <EntityRoomSections
          entity={lead}
          evidenceClaims={[]}
          entityLinkCatalog={catalog}
          firstPaint
        />

        {citing.length > 0 ? (
          <section className="ds-record-beat" id="stories" aria-labelledby="stories-heading">
            <h2 className="ds-record-beat__heading" id="stories-heading">
              Stories
            </h2>
            <Connections
              connections={citing.map((item) => ({
                name: item.title,
                relation: item.relation,
                href: item.href,
              }))}
            />
          </section>
        ) : null}

        <DoorRooms rooms={rooms} />
      </Room>
    );
  }

  return (
    <Room className="ds-home-first-paint">
      {story ? (
        <>
          <h1 className="ds-record-mast__title">{story.title}</h1>
          <p className="ds-record-mast__lede">{story.summary}</p>
          <p>
            <Link className="ds-cta ds-cta--copper" href={`/stories/${story.slug}`}>
              {story.kind === 'article' ? 'Read the entry' : 'Read the chapter'}
            </Link>
          </p>
        </>
      ) : (
        <h1 className="ds-record-mast__title">BlackStory</h1>
      )}
    </Room>
  );
}
