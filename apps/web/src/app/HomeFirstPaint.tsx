/**
 * A published place you walk into from the map. The title is the place. Back is
 * BlackStory at `/`, not another featured sit. Archive chrome (Law, Data, Memorial,
 * Methodology, Errata) is the same on every place. Stories exists only when this
 * record already names a chapter. Evidence, trust, and map/list return paths render
 * when the release carries them.
 */
import React from 'react';
import Link from 'next/link';
import { EntityMastMedia } from '../components/entity/EntityMastMedia';
import { EntitySensitivityBanner } from '../components/entity/EntitySensitivityBanner';
import { LinkedProse, type EntityLinkCatalogEntry } from '../components/entity/LinkedProse';
import { RecordPlacePreview } from '../components/patterns/RecordPlacePreview';
import { RecordVisitBlock } from '../components/patterns/RecordVisitBlock';
import { shouldShowVisitBlock } from '../lib/geography/visit-handoff';
import { Connections, Room, TrustBlock } from '../components/room';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import type { PlaceDiscoveryReturn } from '../lib/discovery/discovery-state';
import { placeDiscoveryReturn } from '../lib/discovery/discovery-state';
import type { PublicEntityView } from '../data/public-seed';
import {
  RecordBeatHead,
  RecordSmallTitle,
  RecordKindPill,
  RecordPill,
  recordSectionIcon,
} from '../components/entity/RecordChrome';
import { EntityRoomSections, renderedBeatCount } from './entity/[id]/EntityRoomSections';
import { toEvidenceClaimInputs, withoutSummaryEchoClaims } from './entity/[id]/adapters';
import { placeHref } from '../lib/place/public-place-path';
import { instrumentRecordHref, placeSlugCollisionCounts } from '../lib/place/place-slug';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import { MAP_BACK } from './walk-back-place';
import { WalkOffRampView } from './walk-off-ramp';
import {
  firstPaintEraLine,
  firstPaintLocatorName,
  firstPaintRecord,
  publishableCitingStories,
  selectDoorRooms,
  walkOnPlaces,
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
  return (
    <nav className="ds-home-door-rooms" aria-label="Archive">
      {rooms.map((room) => (
        // Stories is the one room that is not on every place's door — it exists only when this
        // record already names a chapter, which is a real reason to lead with it. Law, Data,
        // Memorial, Methodology and Errata are the same five links on every place (see the module
        // doc above), so none of them is more "current" than another: copper on one of them by
        // array position read as a false active-tab state that had nothing to do with the place
        // on screen.
        <Link
          key={room.id}
          className={room.id === 'stories' ? 'ds-cta ds-cta--copper' : 'ds-cta ds-cta--quiet'}
          href={room.href}
        >
          {room.label}
        </Link>
      ))}
    </nav>
  );
}

function WalkOnPlaces({
  places,
  collisions,
}: {
  readonly places: readonly PublicEntityView[];
  readonly collisions: ReadonlyMap<string, number>;
}) {
  if (places.length === 0) return null;
  return (
    // Peer suggestions, not the page's primary action — quiet like Data/Memorial/Methodology/
    // Errata above, so a stack of them doesn't compete with the one copper off-ramp below.
    <nav className="ds-home-walk-on" aria-label="Also documented">
      {places.map((place) => {
        const href = instrumentRecordHref(place, collisions) || placeHref(place.displayName);
        return (
          <Link key={place.id} className="ds-cta ds-cta--quiet" href={href}>
            {place.displayName}
          </Link>
        );
      })}
    </nav>
  );
}

function citedSourceCount(claims: PublicEntityView['claims']): number {
  const sources = new Set<string>();
  for (const claim of claims) {
    const key = (claim.citationHref ?? claim.citationSource ?? claim.citationLabel).trim();
    if (key.length > 0) sources.add(key);
  }
  return sources.size;
}

export function HomeFirstPaint({
  model,
  discovery,
}: {
  readonly model: HomeFirstPaintModel;
  readonly discovery?: PlaceDiscoveryReturn;
}) {
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
    const nextPlaces = walkOnPlaces(lead, model.also);
    const collisions = placeSlugCollisionCounts([lead, ...model.also]);
    const locatorName = firstPaintLocatorName(lead);
    const visitInput = {
      displayName: lead.displayName,
      locationLabel: lead.locationLabel,
      jurisdictionLabel: lead.jurisdictionLabel,
      locationPrecision: lead.locationPrecision,
      ...(lead.visit !== undefined ? { visit: lead.visit } : {}),
      kind: lead.kind,
      claims: lead.claims,
      ...(lead.status !== undefined ? { status: lead.status } : {}),
      ...(lead.livingStatus !== undefined ? { livingStatus: lead.livingStatus } : {}),
      ...(lead.sensitivityClass !== undefined ? { sensitivityClass: lead.sensitivityClass } : {}),
      ...(lead.placeAdvisories !== undefined ? { placeAdvisories: lead.placeAdvisories } : {}),
      ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
    };
    const displayClaims = withoutSummaryEchoClaims(lead.claims, lead.summary);
    const evidenceClaims = toEvidenceClaimInputs(displayClaims);
    const inclusionBasis = lead.notabilityLabels ?? [];
    const sourceCount = citedSourceCount(displayClaims);
    const returns =
      discovery ??
      placeDiscoveryReturn(lead.id, {}, geo ? { lat: geo.lat, lng: geo.lng } : undefined);
    const beatsBefore = renderedBeatCount({ entity: lead, evidenceClaims, firstPaint: true });
    const storiesIndex = String(beatsBefore + 1).padStart(2, '0');
    const trustIndex = String(beatsBefore + (citing.length > 0 ? 2 : 1)).padStart(2, '0');

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
              // First paint carries no missing-photo or rights-clearance caption (the mast is the
              // place), but a licensed photograph must show its credit and source: for a Creative
              // Commons pin, attribution is a license condition, not a caption.
              hideCredit={lead.primaryImage === undefined}
              priority
            />
            <figcaption className="ds-record-mast__over">
              <div className="ds-rec-pills" aria-label="Place at a glance">
                <RecordKindPill kind={lead.kind} />
                {eraLine ? (
                  <RecordPill tone="era" icon={recordSectionIcon('era')}>
                    {eraLine}
                  </RecordPill>
                ) : null}
              </div>
              <h1 className="ds-record-mast__title">{lead.displayName}</h1>
              <p className="ds-record-mast__lede">
                <LinkedProse
                  as="span"
                  text={lead.summary}
                  skipEntityIds={[lead.id]}
                  catalog={catalog}
                  hrefFor={(entry) => {
                    const neighbor = [
                      ...(lead.relatedNeighbors ?? []),
                      ...(lead.continueLearning ?? []),
                    ].find((item) => item.id === entry.entityId);
                    if (neighbor) {
                      return (
                        instrumentRecordHref(
                          {
                            id: neighbor.id,
                            displayName: neighbor.displayName,
                            kind: neighbor.kind,
                            summary: neighbor.summary,
                          },
                          collisions,
                        ) || placeHref(entry.label)
                      );
                    }
                    return placeHref(entry.label);
                  }}
                />
              </p>
            </figcaption>
          </figure>
        }
      >
        {geo && locatorName ? (
          <section className="ds-home-place-stand">
            <RecordPlacePreview
              lat={geo.lat}
              lng={geo.lng}
              label={locatorName}
              accessibleName={locatorName}
              interactive
              atlasHref={returns.mapHref}
            />
          </section>
        ) : null}

        {shouldShowVisitBlock(visitInput) ? (
          <RecordVisitBlock
            atlasHref={returns.mapHref}
            {...(locatorName !== undefined ? { locatorLabel: locatorName } : {})}
            {...visitInput}
          />
        ) : null}

        {lead.sensitivity ? (
          <EntitySensitivityBanner sensitivity={lead.sensitivity} entityKind={lead.kind} />
        ) : null}

        <EntityRoomSections
          entity={lead}
          evidenceClaims={evidenceClaims}
          entityLinkCatalog={catalog}
          firstPaint
        />

        {citing.length > 0 ? (
          <section className="ds-record-beat" id="stories" aria-labelledby="stories-heading">
            <RecordBeatHead
              id="stories-heading"
              index={storiesIndex}
              icon="stories"
              title="Stories"
              count={citing.length}
            />
            <Connections
              connections={citing.map((item) => ({
                name: item.title,
                relation: item.relation,
                href: item.href,
              }))}
            />
          </section>
        ) : null}

        <section className="ds-record-beat" id="trust" aria-labelledby="trust-heading">
          <RecordBeatHead
            id="trust-heading"
            index={trustIndex}
            icon="trust"
            title="Can I trust this"
          />
          {/*
           * The inclusion basis, which `/entity/{id}` has always shown in its apparatus band and
           * this room did not. Nearly every visitable record redirects here from there, so the
           * archive's auditable answer to "why is this record in the catalog" — the one thing the
           * rubric exists to publish — was invisible on most of the catalog. It reads before the
           * measurements: why the record is here, then how well it is evidenced.
           */}
          {inclusionBasis.length > 0 ? (
            <>
              <RecordSmallTitle icon="why" id="why-heading">
                Why this is here
              </RecordSmallTitle>
              <ul className="ds-record-rail-block__reasons" aria-labelledby="why-heading">
                {inclusionBasis.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : null}
          <TrustBlock
            label="How this record stands"
            facts={[
              {
                label: 'Research coverage',
                value: lead.researchCoverage.replace(/[_-]+/g, ' '),
              },
              {
                label: 'Cited sources on this page',
                value:
                  sourceCount === 0
                    ? 'None linked yet'
                    : `${sourceCount.toLocaleString('en-US')} ${sourceCount === 1 ? 'source' : 'sources'}`,
              },
              {
                label: 'How a record gets in',
                value: (
                  <Link href="/methodology" prefetch={false}>
                    Methodology
                  </Link>
                ),
              },
              {
                label: 'See a mistake',
                value: (
                  <Link
                    href={`/corrections?target=${encodeURIComponent(lead.id)}`}
                    prefetch={false}
                  >
                    Submit a correction
                  </Link>
                ),
              },
            ]}
          />
        </section>

        <WalkOnPlaces places={nextPlaces} collisions={collisions} />

        <DoorRooms rooms={rooms} />

        <WalkOffRampView
          placeName={MAP_BACK.displayName}
          href={MAP_BACK.href}
          title={
            <>
              Keep going from <em>{lead.displayName}</em>
            </>
          }
          extra={[
            ...(returns.previousHref && returns.previousLabel
              ? [{ href: returns.previousHref, label: returns.previousLabel }]
              : []),
            ...(returns.nextHref && returns.nextLabel
              ? [{ href: returns.nextHref, label: returns.nextLabel }]
              : []),
            { href: returns.mapHref, label: returns.mapLabel },
            { href: returns.listHref, label: returns.listLabel },
            { href: '/methodology', label: 'How a record gets in' },
          ]}
        >
          {returns.positionLabel ? `${returns.positionLabel}. ${lead.summary}` : lead.summary}
        </WalkOffRampView>
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
      <WalkOffRampView placeName={MAP_BACK.displayName} href={MAP_BACK.href}>
        {story ? story.summary : MAP_BACK.displayName}
      </WalkOffRampView>
    </Room>
  );
}
