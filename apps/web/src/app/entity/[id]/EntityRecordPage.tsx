/**
 * The record page for a released entity: `/entity/{id}`, `/place/{slug}` and `/invention/{slug}`.
 *
 * `EntityRecordPage` resolves what the page needs beyond the record itself (the reader's way
 * back, stories that cite it, theme packets that discuss it); `EntityRecordView` is the pure
 * mapping from those facts onto the shared `RecordPage` anatomy, so tests can render it.
 *
 * What the page states is bounded by what the record carries:
 *  - connections are the record's own typed relationships, each with its relation in words;
 *    proximity and collection membership never become a link here (P-02);
 *  - the map frames the stored precision, and "Open in maps" appears only for a visitable site
 *    at site precision (P-03); no line claims an object still stands;
 *  - grade, kind, era and status each appear once; release ids and pipeline tokens never print.
 */
import React from 'react';
import Link from 'next/link';
import { Timeline } from '@repo/ui';
import { containsInternalId, stripInternalIds } from '@repo/public-contracts/narrative-text';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleHalfStroke, faLandmark, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import type { PublicEntityView, RelatedNeighborView } from '../../../data/public-seed';
import {
  formatRecordDate,
  RecordBeat,
  RecordConnections,
  RecordPage,
  RecordProse,
  type RecordConnection,
  type RecordFileRow,
  type RecordMetaItem,
} from '../../../components/patterns/RecordPage';
import { EvidenceList, type EvidenceItem } from '../../../components/evidence/EvidenceList';
import { METHODOLOGY_HOW_RECORD_GETS_IN_HREF } from '../../../components/evidence/editorial-links';
import {
  EntitySensitivityNote,
  TraumaContentNote,
} from '../../../components/entity/EntitySensitivityNote';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { RecordImage } from '../../../components/entity/RecordImage';
import {
  RECORD_GAP_COPY,
  SINGLE_SOURCE_COPY,
  THIN_RECORD_COPY,
  type RecordGapKind,
} from '../../../components/entity/copy';
import { humanizeToken } from '../../../components/entity/format';
import { RecordMap } from '../../../components/map-embed/RecordMap';
import { buildEvidenceCards } from '../../../lib/evidence';
import { confidenceTierPhrase } from '../../../lib/evidence/confidence-language';
import {
  claimSourceKey as sourceKey,
  countClaimSources,
  evidenceCountWords,
} from '../../../lib/map-experience/evidence-grade';
import { confidenceIconFor } from '../../../lib/map-experience/confidence-icons';
import { buildExploreMapSource } from '../../../lib/map-experience/build-explore-map-source';
import { ERA_NOT_DOCUMENTED_LABEL } from '../../../lib/map-experience/entity-era-facts';
import { findUsStateFromJurisdictionLabel } from '@repo/domain/map/geography';
import { precisionInWords } from '../../../lib/map-experience/geo-precision';
import { mapToneFromTopics } from '../../../lib/map-experience/kind-encoding';
import { kindIconFor } from '../../../lib/map-experience/kind-icons';
import { buildExternalMapsSearchUrl } from '../../../lib/geography/external-maps-url';
import { shouldShowVisitBlock } from '../../../lib/geography/visit-handoff';
import { isDisplayableJurisdictionLabel } from '../../../lib/public-data/map-projection';
import {
  discoveryHasNarrowing,
  EMPTY_DISCOVERY_STATE,
  type DiscoveryState,
  type PlaceDiscoveryReturn,
} from '../../../lib/discovery/discovery-state';
import { isInternalRecordLabel, neighborHref } from '../../../lib/place/public-place-path';
import {
  entityCrossReferenceHref,
  entityCrossReferenceLabel,
  resolveEntityCrossReferences,
  type EntityCrossReferenceSurface,
} from '../../../lib/theme-impact/source';
import { resolveCitesEdgeIndex } from '../../../lib/stories/source';
import { storiesCiting } from '../../../lib/release/build-cites-edge';
import { recordDiscoveryReturn } from '../../record-family';
import {
  toEvidenceClaimInputs,
  traumaContentDisclaimerFor,
  withoutSummaryEchoClaims,
} from './adapters';
import { buildEntityAnatomyInputs } from './entity-anatomy-facts';
import { deriveRecordStanding, isSingleSourceRecord, isThinRecord } from './entity-view-model';

void React;

type StoryCitation = ReturnType<typeof storiesCiting>[number];

/**
 * The rail map is a 300px thumbnail: at the site zoom (14) a swamp or a field is an empty tile, so
 * it stops at 12, where the nearest town and water show. The mark stays a site dot, so precision is
 * not overstated; "Open on the map" still frames the record at its full precision zoom.
 */
const RAIL_MAP_MAX_ZOOM = 12;
type Point = { readonly lat: number; readonly lng: number };

/* Small pure helpers. */

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
}

function paragraphs(text: string | undefined): readonly string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function readable(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !isInternalRecordLabel(trimmed) && !containsInternalId(trimmed);
}

/** A record-level link for a neighbor; people, laws and cases have no slug address. */
function neighborRecordHref(neighbor: RelatedNeighborView): string {
  if (['person', 'law', 'case'].includes(String(neighbor.kind))) return `/entity/${neighbor.id}`;
  return neighborHref(neighbor);
}

/** The stored edge in words, read from this record's side. Empty when it cannot be said. */
export function relationInWords(neighbor: RelatedNeighborView): string {
  const via = neighbor.viaEvent?.displayName.trim();
  if (via && readable(via)) return `both appear in ${via}`;
  const phrase = humanizeToken(neighbor.relationType).toLowerCase();
  if (!readable(phrase)) return '';
  return neighbor.direction === 'incoming' ? `${phrase} this record` : phrase;
}

/** Typed, one-hop relationships only. Two-hop leads and graph hops are not this record's facts. */
export function typedConnections(entity: PublicEntityView): readonly RecordConnection[] {
  const seen = new Set<string>();
  const rows: RecordConnection[] = [];
  for (const neighbor of entity.relatedNeighbors ?? []) {
    if (seen.has(neighbor.id) || !readable(neighbor.displayName)) continue;
    const relation = relationInWords(neighbor);
    if (relation.length === 0) continue;
    seen.add(neighbor.id);
    rows.push({
      href: neighborRecordHref(neighbor),
      name: neighbor.displayName,
      relation,
      kind: humanizeToken(String(neighbor.kind)),
    });
  }
  return rows;
}

const STATUS_ECHO =
  /^(status:|current status)|in effect from|\bongoing\b|^active$|^historic$|^unknown$/i;

/** Dated entries that say something; a timeline row that restates the status is dropped. */
export function readableTimeline(
  items: PublicEntityView['timeline'],
): PublicEntityView['timeline'] {
  return items.flatMap((item) => {
    const title = item.title.trim();
    const body = stripInternalIds(item.body);
    if (!readable(title) || STATUS_ECHO.test(title)) return [];
    if (containsInternalId(body) || STATUS_ECHO.test(body.trim())) return [];
    return [{ ...item, title, body }];
  });
}

/** The status a reader can take at its word: never "active" read as "still standing". */
export function metaStatus(entity: PublicEntityView): string | undefined {
  const standing = deriveRecordStanding(entity);
  if (standing === undefined) return undefined;
  // `kind` is typed to the seed's four kinds; released records also carry person, invention and more.
  if (String(entity.kind) !== 'person' && entity.status === 'active') return undefined;
  return standing;
}

function shortPlace(entity: PublicEntityView): string | undefined {
  const jurisdiction = entity.jurisdictionLabel.trim();
  if (isDisplayableJurisdictionLabel(jurisdiction) && readable(jurisdiction)) return jurisdiction;
  const location = entity.locationLabel.trim();
  return readable(location) ? location : undefined;
}

function publisherOf(claim: PublicEntityView['claims'][number]): string {
  return claim.citationSource
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/** A short claim whose object is a bare name reads as nothing; prefix the predicate in words. */
function statementFor(predicate: string, object: string): string {
  const text = object.trim();
  const isSentence = /[.!?]["')\]]?$/.test(text) || text.split(/\s+/).length > 8;
  if (isSentence || predicate.trim().length === 0) return text;
  return `${humanizeToken(predicate)}: ${text}`;
}

function gapsFor(entity: PublicEntityView, shownClaims: number): readonly string[] {
  const gaps: RecordGapKind[] = [];
  if (entity.historicalContext.trim().length === 0) gaps.push('context');
  if (shownClaims === 0) gaps.push('claims');
  if ((entity.relatedNeighbors?.length ?? 0) === 0) gaps.push('related');
  const lines = gaps.map((gap) => RECORD_GAP_COPY[gap].title);
  if (isThinRecord(entity)) lines.push(THIN_RECORD_COPY.title);
  if (isSingleSourceRecord(entity)) lines.push(SINGLE_SOURCE_COPY.title);
  return lines;
}

/* The view. */

export type EntityRecordViewProps = {
  readonly entity: PublicEntityView;
  readonly arrival?: DiscoveryState;
  /** The public point the map draws, when the record has one. */
  readonly point?: Point;
  readonly returns?: PlaceDiscoveryReturn;
  readonly citing?: readonly StoryCitation[];
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
};

export function EntityRecordView({
  entity,
  arrival = EMPTY_DISCOVERY_STATE,
  point,
  returns,
  citing = [],
  crossReferences = [],
}: EntityRecordViewProps) {
  const tone = mapToneFromTopics(entity.topicIds ?? entity.topicTags);
  const anatomy = buildEntityAnatomyInputs(entity, tone);
  const place = shortPlace(entity);
  const eraKnown = anatomy.eraLabel !== ERA_NOT_DOCUMENTED_LABEL;
  const status = metaStatus(entity);
  /* A sensitivity flag's note already carries the sensitive-content disclaimer; never print it twice. */
  const trauma = entity.sensitivity ? undefined : traumaContentDisclaimerFor(entity);

  /* The place glyph belongs to the place; a place-kind record's kind word takes a landmark. */
  const kindIcon = kindIconFor(entity.kind, tone);
  const meta: RecordMetaItem[] = [
    { label: anatomy.kindLabel, icon: kindIcon === faLocationDot ? faLandmark : kindIcon },
    ...(place && place.toLowerCase() !== entity.displayName.toLowerCase()
      ? [{ label: place, icon: faLocationDot }]
      : []),
    ...(status ? [{ label: status, icon: faCircleHalfStroke }] : []),
  ];

  /* Evidence: the claims the page shows (a claim restating the lede is the lede's own source). */
  const shownClaims = withoutSummaryEchoClaims(entity.claims, entity.summary);
  const cards = buildEvidenceCards(toEvidenceClaimInputs(shownClaims));
  const evidence: EvidenceItem[] = cards.map((card, index) => {
    const claim = shownClaims[index]!;
    return {
      id: `source-${index + 1}`,
      statement: statementFor(card.predicate, card.object),
      source: {
        ...(publisherOf(claim) ? { publisher: publisherOf(claim) } : {}),
        title: card.citation.label || publisherOf(claim),
        ...(card.citation.href ? { href: card.citation.href } : {}),
        ...(card.citation.archivedUrl ? { archivedUrl: card.citation.archivedUrl } : {}),
        ...(card.citation.archivedAt ? { archivedAt: card.citation.archivedAt } : {}),
        ...(card.citation.withheldReason ? { note: card.citation.withheldReason } : {}),
      },
      level: card.confidenceLevel,
      ...(card.dispute ? { dispute: card.dispute } : {}),
      ...(card.retraction ? { retraction: card.retraction } : {}),
    };
  });
  const shownKeys = new Set(shownClaims.map(sourceKey));
  const alsoCited = [
    ...new Map(
      entity.claims
        .filter((claim) => !shownKeys.has(sourceKey(claim)) && sourceKey(claim).length > 0)
        .map((claim) => [sourceKey(claim), claim] as const),
    ).values(),
  ];

  /* Where, when, evidence: the three facts a reader checks first. */
  const whereValue = anatomy.whereLabel === 'Place withheld' ? 'Not public' : anatomy.whereLabel;
  const tier = anatomy.evidenceTier;
  const facts = [
    {
      label: 'Where' as const,
      value: whereValue,
      detail: point ? precisionInWords(entity.locationPrecision) : 'No public map location',
    },
    {
      label: 'When' as const,
      value: eraKnown ? anatomy.eraLabel : 'Not dated yet',
    },
    {
      label: 'Evidence' as const,
      value:
        evidence.length > 0 ? (
          <a className={`ds-recpage__grade ds-grade-tag--${tier}`} href="#sources">
            <FontAwesomeIcon
              icon={confidenceIconFor(tier)}
              className="ds-recpage__icon"
              aria-hidden="true"
            />
            {confidenceTierPhrase(tier)}
          </a>
        ) : (
          'Not graded'
        ),
      detail:
        evidence.length > 0
          ? evidenceCountWords(entity.claims.length, countClaimSources(entity.claims))
          : 'No accepted claims yet',
    },
  ];

  /* The rail: a real photograph when one exists, the map at its stored precision. */
  const visitInput = {
    displayName: entity.displayName,
    locationLabel: entity.locationLabel,
    jurisdictionLabel: entity.jurisdictionLabel,
    locationPrecision: entity.locationPrecision,
    kind: entity.kind,
    ...(entity.visit !== undefined ? { visit: entity.visit } : {}),
    ...(point ? point : {}),
  };
  const externalMapsHref =
    point && shouldShowVisitBlock(visitInput)
      ? buildExternalMapsSearchUrl({ ...point, query: anatomy.whereLabel })
      : undefined;
  const statePostalCode = findUsStateFromJurisdictionLabel(entity.jurisdictionLabel)?.postalCode;
  const media =
    entity.primaryImage || point ? (
      <>
        {entity.primaryImage ? (
          <RecordImage
            entityId={entity.id}
            entityName={entity.displayName}
            image={entity.primaryImage}
          />
        ) : null}
        {point ? (
          <RecordMap
            lat={point.lat}
            lng={point.lng}
            label={String(entity.kind) === 'person' ? (place ?? whereValue) : entity.displayName}
            precision={entity.locationPrecision}
            {...(statePostalCode ? { statePostalCode } : {})}
            maxZoom={RAIL_MAP_MAX_ZOOM}
            caption={false}
          />
        ) : null}
      </>
    ) : undefined;

  /* The way back: the list or map the reader came from, or the register. */
  const fromList = arrival.view === 'list' && returns !== undefined;
  const fromNarrowedMap =
    arrival.view === 'map' && discoveryHasNarrowing(arrival) && returns !== undefined;
  const crumb = fromList
    ? { href: returns.listHref, label: 'Back to the list' }
    : fromNarrowedMap
      ? { href: returns.mapHref, label: 'Back to the map' }
      : { href: '/records', label: 'Records' };

  /* Body beats. */
  const neighborsById = new Map((entity.relatedNeighbors ?? []).map((n) => [n.id, n] as const));
  const catalog: EntityLinkCatalogEntry[] = [...neighborsById.values()]
    .filter((neighbor) => readable(neighbor.displayName))
    .map((neighbor) => ({ id: neighbor.id, displayName: neighbor.displayName }));
  const hrefFor = ({ entityId }: { readonly entityId: string }) => {
    const neighbor = neighborsById.get(entityId);
    return neighbor ? neighborRecordHref(neighbor) : `/entity/${entityId}`;
  };
  const prose = (text: string, key: string) => (
    <LinkedProse
      key={key}
      text={text}
      skipEntityIds={[entity.id]}
      catalog={catalog}
      hrefFor={hrefFor}
    />
  );
  const history = [
    ...paragraphs(entity.historicalContext),
    ...paragraphs(entity.extendedNarrative),
  ];
  const impact = paragraphs(entity.impactStatement);
  const timeline = readableTimeline(entity.timeline);
  const connections = typedConnections(entity);
  const writtenAbout = [
    ...citing
      .filter((story) => readable(story.title))
      .map((story) => ({ href: story.href, name: story.title, relation: story.relation })),
    ...crossReferences.map((surface) => ({
      href: entityCrossReferenceHref(surface),
      name: entityCrossReferenceLabel(surface),
      relation: 'theme study',
    })),
  ];

  /* The record file. */
  const gaps = gapsFor(entity, evidence.length);
  /* A reviewed inclusion note that restates the lede or a printed claim adds nothing. */
  const printed = new Set(
    [entity.summary, ...shownClaims.map((claim) => claim.object)].map((text) =>
      text.trim().replace(/\.$/, '').toLowerCase(),
    ),
  );
  const inclusion = [
    ...new Set((entity.notabilityBasis ?? []).map((basis) => basis.note.trim())),
  ].filter(
    (note) =>
      note.length > 0 && readable(note) && !printed.has(note.replace(/\.$/, '').toLowerCase()),
  );
  const updated = formatRecordDate(entity.revision.recordUpdatedAt);
  const file: RecordFileRow[] = [
    ...(updated ? [{ label: 'Last updated', value: <time>{updated}</time> }] : []),
    ...(inclusion.length > 0
      ? [
          {
            label: 'Why it is included',
            value: (
              <ul className="ds-recpage__plain-list">
                {inclusion.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(gaps.length > 0
      ? [
          {
            label: 'Still to research',
            value: (
              <ul className="ds-recpage__plain-list">
                {gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(alsoCited.length > 0
      ? [
          {
            label: 'Also cited',
            value: (
              <ul className="ds-recpage__plain-list">
                {alsoCited.map((claim) => (
                  <li key={sourceKey(claim)}>
                    {claim.citationHref ? (
                      <a href={claim.citationHref} rel="noopener noreferrer">
                        {claim.citationLabel || publisherOf(claim)}
                      </a>
                    ) : (
                      claim.citationLabel || publisherOf(claim)
                    )}
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    {
      label: 'Method',
      value: (
        <Link href={METHODOLOGY_HOW_RECORD_GETS_IN_HREF} prefetch={false}>
          How a record gets in and how evidence is graded
        </Link>
      ),
    },
  ];

  const pagerName = (label: string | undefined) => label?.replace(/^(Previous|Next): /, '') ?? '';

  return (
    <RecordPage
      crumb={crumb}
      title={entity.displayName}
      meta={meta}
      ledeText={entity.summary}
      lede={
        <LinkedProse
          as="span"
          text={entity.summary}
          skipEntityIds={[entity.id]}
          catalog={catalog}
          hrefFor={hrefFor}
        />
      }
      note={
        entity.sensitivity ? (
          <EntitySensitivityNote sensitivity={entity.sensitivity} entityKind={entity.kind} />
        ) : trauma ? (
          <TraumaContentNote disclaimer={trauma} />
        ) : undefined
      }
      facts={facts}
      media={media}
      actions={{
        ...(point && returns ? { map: { href: returns.mapHref } } : {}),
        ...(externalMapsHref ? { externalMapsHref } : {}),
        correctionHref: `/corrections?target=${encodeURIComponent(entity.id)}`,
      }}
      {...(evidence.length > 0 ? { sourcesAnchor: 'sources' } : {})}
      file={file}
      {...(fromList && (returns.previousHref || returns.nextHref)
        ? {
            pager: {
              label: 'Records in this list',
              ...(returns.positionLabel ? { position: returns.positionLabel } : {}),
              ...(returns.previousHref
                ? {
                    previous: {
                      href: returns.previousHref,
                      label: pagerName(returns.previousLabel),
                    },
                  }
                : {}),
              ...(returns.nextHref
                ? { next: { href: returns.nextHref, label: pagerName(returns.nextLabel) } }
                : {}),
            },
          }
        : {})}
    >
      {history.length > 0 ? (
        <RecordBeat id="history" title="History">
          <RecordProse>{history.map((text, index) => prose(text, `h-${index}`))}</RecordProse>
        </RecordBeat>
      ) : null}

      {impact.length > 0 ? (
        <RecordBeat id="impact" title="What it changed">
          <RecordProse>{impact.map((text, index) => prose(text, `i-${index}`))}</RecordProse>
        </RecordBeat>
      ) : null}

      {evidence.length > 0 ? (
        <RecordBeat id="sources" title="What the sources say">
          <EvidenceList items={evidence} />
        </RecordBeat>
      ) : null}

      {timeline.length > 0 ? (
        <RecordBeat id="timeline" title="Timeline">
          <Timeline labelledBy="timeline-heading" items={timeline} />
        </RecordBeat>
      ) : null}

      {connections.length > 0 ? (
        <RecordBeat id="connections" title="Connected records">
          <RecordConnections connections={connections} />
        </RecordBeat>
      ) : null}

      {writtenAbout.length > 0 ? (
        <RecordBeat id="written-about" title="Written about in">
          <RecordConnections connections={writtenAbout} />
        </RecordBeat>
      ) : null}
    </RecordPage>
  );
}

/* The route body. */

export async function EntityRecordPage({
  entity,
  arrival = EMPTY_DISCOVERY_STATE,
}: {
  readonly entity: PublicEntityView;
  readonly arrival?: DiscoveryState;
}) {
  const feature = buildExploreMapSource([entity]).featureCollection.features[0];
  const point = feature
    ? { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
    : undefined;
  const [returns, crossReferences, cites] = await Promise.all([
    recordDiscoveryReturn(entity.id, arrival, feature !== undefined),
    resolveEntityCrossReferences(entity.id),
    resolveCitesEdgeIndex(),
  ]);
  return (
    <EntityRecordView
      entity={entity}
      arrival={arrival}
      {...(point ? { point } : {})}
      returns={returns}
      citing={storiesCiting(cites, entity.id)}
      crossReferences={crossReferences}
    />
  );
}
