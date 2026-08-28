/**
 * Server-rendered front door: the featured place's record, using the existing record room.
 *
 * Not a manifesto, not a schema card, and not the Atlas board. Greenwood (live) or the
 * seed place is the page: mast, locator, and history. Stories, Law, Data, and
 * Memorial are the way out. No schema strip, no confidence badge, no precision leak.
 */
import React from 'react';
import Link from 'next/link';
import { EntityMastMedia } from '../components/entity/EntityMastMedia';
import { EntitySensitivityBanner } from '../components/entity/EntitySensitivityBanner';
import { LinkedProse, type EntityLinkCatalogEntry } from '../components/entity/LinkedProse';
import { RecordPlacePreview } from '../components/patterns/RecordPlacePreview';
import { OffRamp, Room } from '../components/room';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import { destinationFor } from '../lib/nav/destination-registry';
import type { PublicEntityView } from '../data/public-seed';
import { EntityRoomSections } from './entity/[id]/EntityRoomSections';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import '../components/entity/entity-page.css';
import './record-page.css';
import './entity/[id]/record-room.css';
import './home-first-paint.css';

void React;

const DOOR_ROOMS = ['/stories', '/law', '/data', '/memorial'] as const;

function neighborCatalog(entity: PublicEntityView): readonly EntityLinkCatalogEntry[] {
  const seen = new Set<string>();
  const catalog: EntityLinkCatalogEntry[] = [];
  for (const neighbor of [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])]) {
    if (seen.has(neighbor.id) || neighbor.displayName.trim().length === 0) continue;
    seen.add(neighbor.id);
    catalog.push({ id: neighbor.id, displayName: neighbor.displayName });
  }
  return catalog;
}

function DoorRooms({ copper }: { readonly copper: boolean }) {
  const actions = DOOR_ROOMS.map((path, index) => {
    const room = destinationFor(path);
    return {
      href: path,
      label: room?.label ?? path.slice(1),
      ...(copper && index === 0 ? { emphasis: 'copper' as const } : {}),
    };
  });
  const names = actions.map((action) => action.label).join(', ');
  return (
    <OffRamp title={names} actions={actions}>
      {destinationFor('/stories')?.description ?? names}
    </OffRamp>
  );
}

export function HomeFirstPaint({ model }: { readonly model: HomeFirstPaintModel }) {
  const lead =
    model.lead && !isInternalRecordLabel(model.lead.displayName) ? model.lead : undefined;
  const story = model.story && !isInternalRecordLabel(model.story.title) ? model.story : undefined;

  if (lead) {
    const catalog = neighborCatalog(lead);
    const geo = lead.geoAnchor ?? geoAnchorFor(lead.id);

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

        <EntityRoomSections entity={lead} evidenceClaims={[]} entityLinkCatalog={catalog} />

        <p>
          <Link className="ds-cta ds-cta--quiet" href={`/entity/${lead.id}`}>
            Open the full record
          </Link>
        </p>

        <DoorRooms copper />
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
      <DoorRooms copper={!story} />
    </Room>
  );
}
