/**
 * A published place you walk into from the map. The title is the place. Back is
 * BlackStory at `/`, not another featured sit. Archive chrome (Law, Data, Memorial,
 * Methodology, Errata) is the same on every place. Stories exists only when this
 * record already names a chapter. Evidence, trust, and map/list return paths render
 * when the release carries them.
 *
 * Visual law (plan.md Phase 1): the mast is a photograph at full bleed, or the map at
 * neighborhood zoom as the hero. Evidence (confidence, precision, source count) sits at
 * display scale. Typed relationships and site-nav chips use distinct treatments.
 */
import React from 'react';
import Link from 'next/link';
import { EntityMastMedia, RecordPhotoCredit } from '../components/entity/EntityMastMedia';
import { EntitySensitivityBanner } from '../components/entity/EntitySensitivityBanner';
import { LinkedProse, type EntityLinkCatalogEntry } from '../components/entity/LinkedProse';
import { RecordInvestigationReturn } from '../components/discovery/record-investigation-return';
import { RecordPlacePreview } from '../components/patterns/RecordPlacePreview';
import { RecordVisitBlock } from '../components/patterns/RecordVisitBlock';
import { shouldShowVisitBlock } from '../lib/geography/visit-handoff';
import { Connections, Room, TrustBlock } from '../components/room';
import { geoAnchorFor } from '../lib/map-experience/entity-geo';
import { recordConfidenceTier } from '../lib/map-experience/build-explore-map-source';
import type { PlaceDiscoveryReturn } from '../lib/discovery/discovery-state';
import { placeDiscoveryReturn } from '../lib/discovery/discovery-state';
import type { PublicEntityView } from '../data/public-seed';
import {
  RecordBeatHead,
  RecordFactTile,
  RecordSmallTitle,
  RecordKindPill,
  RecordPill,
  RecordGradePill,
  recordSectionIcon,
} from '../components/entity/RecordChrome';
import { confidenceTierPhrase } from '../lib/evidence/confidence-language';
import { humanizeToken } from '../components/entity/format';
import { confidenceIconFor } from '../lib/map-experience/confidence-icons';
import { METHODOLOGY_HOW_RECORD_GETS_IN_HREF } from '../components/evidence/editorial-links';
import { EntityRoomSections } from './entity/[id]/EntityRoomSections';
import {
  buildWhyThisAppearsForEntity,
  claimTextMatcher,
  toEvidenceClaimInputs,
  whyAppearsEvidenceById,
  withoutSummaryEchoClaims,
} from './entity/[id]/adapters';
import { WhyThisAppears } from '../components/why-appears';
import { placeHref } from '../lib/place/public-place-path';
import { instrumentRecordHref, placeSlugCollisionCounts } from '../lib/place/place-slug';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import { MAP_BACK } from './walk-back-place';
import { WalkOffRampView } from './walk-off-ramp';
import {
  firstPaintEraLink,
  firstPaintLocatorName,
  firstPaintRecord,
  humanPlaceLine,
  publishableCitingStories,
  selectDoorRooms,
  walkOnPlaces,
} from './home-first-paint-surface';
import { destinationById } from '../lib/nav/destination-registry';
import { DestinationIcon } from '../components/patterns/DestinationIcon';
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
      {rooms.map((room) => {
        const icon = destinationById(room.id)?.icon;
        return (
          <Link
            key={room.id}
            className={room.id === 'stories' ? 'ds-cta ds-cta--copper' : 'ds-cta ds-cta--quiet'}
            href={room.href}
          >
            {icon ? <DestinationIcon id={icon} /> : null}
            {room.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Kinds that land in the place family but have no meaningful geographic neighbours. */
const NON_SPATIAL_PLACE_FAMILY_KINDS: ReadonlySet<string> = new Set(['law']);

function WalkOnPlaces({
  places,
  collisions,
}: {
  readonly places: readonly PublicEntityView[];
  readonly collisions: ReadonlyMap<string, number>;
}) {
  if (places.length === 0) return null;
  return (
    <section className="ds-record-beat" aria-labelledby="walk-on-heading">
      <RecordSmallTitle id="walk-on-heading" icon="continue">
        Also documented
      </RecordSmallTitle>
      <nav className="ds-home-walk-on" aria-labelledby="walk-on-heading">
        {places.map((place) => {
          const href = instrumentRecordHref(place, collisions) || placeHref(place.displayName);
          return (
            <Link key={place.id} className="ds-relation-chip" href={href}>
              {place.displayName}
            </Link>
          );
        })}
      </nav>
    </section>
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

function evidenceGradeWord(tier: ReturnType<typeof recordConfidenceTier>): string {
  if (tier === 'high') return 'Grade A';
  if (tier === 'medium') return 'Grade B';
  if (tier === 'low') return 'Grade C';
  return 'Unrated';
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
    const eraLink = firstPaintEraLink(lead);
    const nextPlaces = walkOnPlaces(lead, model.also);
    /*
     * This family is a catch-all: `familyForKind` routes everything that is not an invention
     * here, so most kinds arriving are genuinely spatial (place, school, church, district) and
     * a few are not. A statute was being described as a place and offered a church and a
     * cemetery as neighbours purely because they sit near its enactment point, which reads as
     * a relationship the sources do not state (P-02).
     *
     * A deny-list, not an allow-list: the spatial kinds are open-ended and an allow-list
     * silently demoted every one it had not heard of. Add a kind here only when nearest-place
     * neighbours would be misleading for it.
     */
    const isPlaceLike = !NON_SPATIAL_PLACE_FAMILY_KINDS.has(lead.kind ?? '');
    const glanceLabel = isPlaceLike ? 'Place at a glance' : 'Record at a glance';
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
    const whyThisAppears = buildWhyThisAppearsForEntity(lead);
    const sourceCount = citedSourceCount(displayClaims);
    const confidenceTier = recordConfidenceTier(lead.claims);
    const gradeWord = evidenceGradeWord(confidenceTier);
    const precisionValue = geo ? humanizeToken(lead.locationPrecision) : 'Not pinned';
    const hasPhoto = lead.primaryImage !== undefined;
    const returns =
      discovery ??
      placeDiscoveryReturn(lead.id, {}, geo ? { lat: geo.lat, lng: geo.lng } : undefined);

    const evidenceStrip = (
      <div className="ds-rec-facts ds-record-evidence-strip">
        <dl
          className="ds-rec-facts__tiles ds-rec-facts__tiles--glance"
          aria-label="Evidence at a glance"
        >
          <RecordFactTile
            className={`ds-rec-tile--evidence ds-rec-tile--evidence-${confidenceTier}`}
            icon={confidenceIconFor(confidenceTier)}
            label="Confidence"
            /*
             * Plain words, not a bare letter. The reader met "Grade A" here and "Evidence
             * grade: high" a few hundred pixels below, two vocabularies for one idea. The
             * letter still exists where it is load-bearing: the citation string carries it,
             * and the native app shares it through public-contracts.
             */
            value={
              <RecordGradePill tier={confidenceTier}>
                {confidenceTierPhrase(confidenceTier)}
              </RecordGradePill>
            }
            support={
              gradeWord === 'Unrated'
                ? 'Not graded on this page'
                : `Evidence grade ${gradeWord.replace(/^Grade /, '')}`
            }
          />
          <RecordFactTile
            icon={recordSectionIcon('where')}
            label="Precision"
            value={precisionValue}
            support={geo ? 'How sharp the pin is' : 'No public map location'}
          />
          <RecordFactTile
            icon={recordSectionIcon('claims')}
            label="Sources"
            value={sourceCount === 0 ? 'None' : sourceCount.toLocaleString('en-US')}
            support={
              sourceCount === 0
                ? 'Not linked on this page'
                : sourceCount === 1
                  ? 'cited source'
                  : 'cited sources'
            }
          />
        </dl>
      </div>
    );

    const placeLine = humanPlaceLine(lead);
    const geographyLine =
      placeLine?.toLocaleLowerCase() === lead.displayName.toLocaleLowerCase()
        ? humanPlaceLine({ ...lead, locationLabel: '' })
        : placeLine;

    /* The way back into the investigation that sent the reader here: the map and the list, with
       the narrowing they carried. Kept apart from the archive navigation (home, rooms) below. */
    const investigationReturn = <RecordInvestigationReturn returns={returns} family="place" />;

    const mastMedia = hasPhoto ? (
      <EntityMastMedia
        entityId={lead.id}
        entityName={lead.displayName}
        kind={lead.kind}
        {...(lead.primaryImage !== undefined ? { primaryImage: lead.primaryImage } : {})}
        hideCredit
        priority
      />
    ) : geo && locatorName ? (
      <div className="ds-record-mast__map">
        <RecordPlacePreview
          lat={geo.lat}
          lng={geo.lng}
          label={locatorName}
          accessibleName={locatorName}
          interactive
          neighborhood
        />
        <p className="ds-record-mast__map-note">Published location precision: {precisionValue}.</p>
      </div>
    ) : (
      <EntityMastMedia entityId={lead.id} entityName={lead.displayName} hideCredit priority />
    );

    return (
      <Room
        className="ds-home-first-paint"
        masthead={
          <>
            {investigationReturn}
            <figure
              className="ds-record-mast"
              data-media={hasPhoto ? 'photo' : geo ? 'map' : 'mark'}
            >
              {mastMedia}
              <figcaption className="ds-record-mast__over">
                <div className="ds-rec-pills" aria-label={glanceLabel}>
                  <RecordKindPill kind={lead.kind} />
                  {eraLink ? (
                    <RecordPill
                      tone="era"
                      icon={recordSectionIcon('era')}
                      {...(eraLink.href ? { href: eraLink.href } : {})}
                    >
                      {eraLink.label}
                    </RecordPill>
                  ) : null}
                </div>
                <h1 className="ds-record-mast__title">{lead.displayName}</h1>
                {geographyLine ? <p className="ds-record-mast__where">{geographyLine}</p> : null}
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
                {lead.primaryImage !== undefined ? (
                  <RecordPhotoCredit
                    entityId={lead.id}
                    image={lead.primaryImage}
                    className="ds-record-mast__credit"
                  />
                ) : null}
              </figcaption>
            </figure>
            {evidenceStrip}
          </>
        }
      >
        {/* Visit / maps handoff only when there is something to visit. The mast already
            carries the one map affordance (pin → atlas). */}
        {shouldShowVisitBlock(visitInput) ? (
          <RecordVisitBlock
            className="ds-record-beat"
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

        {evidenceClaims.length === 0 ? (
          <section
            className="ds-record-beat"
            id="evidence-gap"
            aria-labelledby="evidence-gap-heading"
          >
            <RecordBeatHead id="evidence-gap-heading" icon="claims" title="Evidence on this page" />
            <p className="ds-record-evidence-gap">
              This place is in the release with a name, location and era. Cited sources have not
              been linked on this page yet. Coverage is recorded as{' '}
              {lead.researchCoverage.replace(/[_-]+/g, ' ')}.
            </p>
          </section>
        ) : null}

        {citing.length > 0 ? (
          <section className="ds-record-beat" id="stories" aria-labelledby="stories-heading">
            <RecordBeatHead
              id="stories-heading"
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
          <RecordBeatHead id="trust-heading" icon="trust" title="Can I trust this" />
          <section aria-labelledby="why-heading">
            <RecordSmallTitle icon="why" id="why-heading">
              Why this is here
            </RecordSmallTitle>
            {whyThisAppears ? (
              <WhyThisAppears
                result={whyThisAppears}
                evidenceById={whyAppearsEvidenceById(lead)}
                isPrintedClaim={claimTextMatcher(displayClaims)}
              />
            ) : (
              <p>An inclusion explanation with linked evidence has not been recorded.</p>
            )}
          </section>
          <TrustBlock
            label="How this record stands"
            facts={[
              {
                label: 'How a record gets in',
                value: (
                  <Link href={METHODOLOGY_HOW_RECORD_GETS_IN_HREF} prefetch={false}>
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

        {/*
         * Nearest places are only a meaningful "what next" for a record that is itself a
         * place. A statute catalogued in this family was being offered a church and a cemetery
         * as its neighbours purely because they are near its enactment point, which reads as a
         * relationship the sources do not state (P-02).
         */}
        {isPlaceLike ? <WalkOnPlaces places={nextPlaces} collisions={collisions} /> : null}

        <DoorRooms rooms={rooms} />

        <WalkOffRampView
          placeName={`Back to ${MAP_BACK.displayName}`}
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
            { href: returns.listHref, label: returns.listLabel },
          ]}
        >
          {returns.positionLabel
            ? returns.positionLabel
            : 'Return to the map, or continue through the list.'}
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
              {story.format === 'entry' ? 'Read the entry' : 'Read the chapter'}
            </Link>
          </p>
        </>
      ) : (
        <p>This place is not in the current release.</p>
      )}
    </Room>
  );
}
