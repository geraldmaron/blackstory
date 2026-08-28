/**
 * Server-rendered front door: the featured place's record, using the existing record room.
 *
 * Not a manifesto, not a schema card, and not the Atlas board. Greenwood (live) or the
 * seed place is the page: mast, locator, and history. Stories, Law, Data, and
 * Memorial exist only when this record already has material for that room.
 * No schema strip, no confidence badge, no precision leak, no second record page.
 */
import React from 'react';
import Link from 'next/link';
import { EntityMastMedia } from '../components/entity/EntityMastMedia';
import { EntitySensitivityBanner } from '../components/entity/EntitySensitivityBanner';
import { LinkedProse, type EntityLinkCatalogEntry } from '../components/entity/LinkedProse';
import { RecordPlacePreview } from '../components/patterns/RecordPlacePreview';
import { Connections, OffRamp, Room } from '../components/room';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import type { PublicEntityView, RelatedNeighborView } from '../data/public-seed';
import { EntityRoomSections } from './entity/[id]/EntityRoomSections';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import {
  firstPaintRecord,
  firstPaintRelation,
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

function neighborsOfKind(
  entity: PublicEntityView,
  kinds: ReadonlySet<string>,
): readonly RelatedNeighborView[] {
  return [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])].filter(
    (neighbor) =>
      kinds.has(String(neighbor.kind)) &&
      neighbor.displayName.trim().length > 0 &&
      !isInternalRecordLabel(neighbor.displayName),
  );
}

function DoorRooms({
  rooms,
}: {
  readonly rooms: ReturnType<typeof selectDoorRooms>;
}) {
  if (rooms.length === 0) return null;
  const actions = rooms.map((room, index) => ({
    href: room.href,
    label: room.label,
    ...(index === 0 ? { emphasis: 'copper' as const } : {}),
  }));
  const names = rooms.map((room) => room.label).join(', ');
  return (
    <OffRamp title={names} actions={actions}>
      What this place already holds.
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
    const lawNeighbors = neighborsOfKind(lead, new Set(['law', 'case']));
    const memorialNeighbors = neighborsOfKind(lead, new Set(['person']));

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
          <section className="ds-record-beat" aria-labelledby="cited-stories-heading">
            <h2 className="ds-record-beat__heading" id="cited-stories-heading">
              Written about this place
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

        {lawNeighbors.length > 0 ? (
          <section className="ds-record-beat" id="law" aria-labelledby="law-heading">
            <h2 className="ds-record-beat__heading" id="law-heading">
              Law
            </h2>
            <Connections
              connections={lawNeighbors.map((neighbor) => ({
                name: neighbor.displayName,
                relation: firstPaintRelation(neighbor, lead) ?? '',
                href: `/entity/${neighbor.id}`,
              }))}
            />
          </section>
        ) : null}

        {memorialNeighbors.length > 0 ? (
          <section className="ds-record-beat" id="memorial" aria-labelledby="memorial-heading">
            <h2 className="ds-record-beat__heading" id="memorial-heading">
              Memorial
            </h2>
            <Connections
              connections={memorialNeighbors.map((neighbor) => ({
                name: neighbor.displayName,
                relation: firstPaintRelation(neighbor, lead) ?? '',
                href: `/entity/${neighbor.id}`,
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
