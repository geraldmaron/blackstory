/**
 * Entity detail page for place/school/event/institution public records. Editorial mast
 * (media plane + name + serif summary) leads; slim at-a-glance labeled facts follow before
 * sustained reading. Main spine: relevance, historical context, status, accepted claims,
 * timeline, and unified connected records. Slim context rail: map, maturity, revision.
 * Sparse sections render the approved `RecordGapNotice` copy instead of a silent empty list.
 * Timeline is omitted entirely when no dated status or relationship timespans exist.
 *
 * Must stay dynamic: App Hosting mounts DATABASE_URL at RUNTIME only. Build-time static
 * `/entity/[id]` for seed-cluster ids previously baked `seed-snapshot` while non-seed ids
 * still read live Postgres (`rel_seed_001`) — the same class of split as the map hero.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Runtime Postgres reads; never bake Dunbar seed at build without DATABASE_URL. */
export const dynamic = 'force-dynamic';
import { MapFrame, Timeline } from '@repo/ui';
import { KindBadge, ConfidenceMark, MapsExternalLink } from '../../../components/map-experience';
import { EntityLocationMapLazy } from '../../../components/entity/EntityLocationMapLazy';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import '../../../components/entity/entity-page.css';
import { EntityStatusPanel } from '../../../components/entity/EntityStatusPanel';
import { EntityRelatedList } from '../../../components/entity/EntityRelatedList';
import { EntityLinkDiscoveryHint } from '../../../components/entity/EntityLink';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import { EntityMastMedia } from '../../../components/entity/EntityMastMedia';
import { RecordGapNotice } from '../../../components/entity/RecordGapNotice';
import { humanizeToken } from '../../../components/entity/format';
import { EntityEvidencePanel } from '../../../components/evidence';
import { HowToReadThisRecord } from '../../../components/trust';
import { WhyThisAppears } from '../../../components/why-appears';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { buildExternalMapsSearchUrl } from '../../../lib/geography/external-maps-url';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../../lib/map-experience/url-state';
import { highestConfidence } from '../../../lib/map-experience/build-explore-map-source';
import { mapToneFromTopics } from '../../../lib/map-experience/kind-encoding';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import {
  getPublicSearchIndex,
  resolvePublicEntityView,
} from '../../../lib/public-data/source';
import { isDisplayableJurisdictionLabel } from '../../../lib/public-data/map-projection';
import {
  buildWhyThisAppearsForEntity,
  toEvidenceClaimInputs,
  whyAppearsEvidenceById,
} from './adapters';
import { deriveHistoricalFraming } from './entity-view-model';
import { EntitySessionNavClient } from './entity-session-nav-client';

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

function entityLinkCatalogFromNeighbors(
  entity: NonNullable<Awaited<ReturnType<typeof resolvePublicEntityView>>['data']>,
): readonly EntityLinkCatalogEntry[] {
  const seen = new Set<string>();
  const catalog: EntityLinkCatalogEntry[] = [];
  for (const neighbor of [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])]) {
    if (seen.has(neighbor.id) || neighbor.displayName.trim().length === 0) {
      continue;
    }
    seen.add(neighbor.id);
    catalog.push({ id: neighbor.id, displayName: neighbor.displayName });
  }
  return catalog;
}

export async function generateStaticParams() {
  // Thin id list from the search index — never hydrate full entity graphs for GSP.
  const { data: index } = await getPublicSearchIndex();
  return index.map((doc) => ({ id: doc.id }));
}

export async function generateMetadata({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  if (!resolved.data) {
    return { title: 'Record not found' };
  }
  return buildEntityPageMetadata({
    id: resolved.data.id,
    displayName: resolved.data.displayName,
    summary: resolved.data.summary,
    kind: resolved.data.kind,
    ...(resolved.data.primaryImage !== undefined
      ? { imageUrl: resolved.data.primaryImage.url }
      : {}),
  });
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  const entity = resolved.data;
  if (!entity) {
    notFound();
  }

  const framing = deriveHistoricalFraming(entity);
  const framingLabel = framing === 'present_day' ? 'Present-day record' : 'Historical record';
  const jurisdictionLabel = isDisplayableJurisdictionLabel(entity.jurisdictionLabel)
    ? entity.jurisdictionLabel.trim()
    : undefined;
  const confidenceTier = highestConfidence(entity.claims);
  const mapTone = mapToneFromTopics(entity.topicTags);
  // Fail-closed, not fail-crashed: the domain layer throws when a record lacks
  // a substantiated notability basis . That withholds the explanation —
  // it must never take the whole record page down with it.
  const whyThisAppears = (() => {
    try {
      return buildWhyThisAppearsForEntity(entity);
    } catch {
      return undefined;
    }
  })();
  const evidenceClaims = toEvidenceClaimInputs(entity.claims);
  const geoAnchor = entity.geoAnchor ?? geoAnchorFor(entity.id);
  const mapsHref = buildExternalMapsSearchUrl({
    ...(geoAnchor ? { lat: geoAnchor.lat, lng: geoAnchor.lng } : {}),
    query: entity.locationLabel,
  });
  const entityLinkCatalog = entityLinkCatalogFromNeighbors(entity);
  const continueLearning = entity.continueLearning ?? [];
  const exploreHref = buildExploreHref({
    filters: { era: 'all', kind: 'all', tone: 'all', theme: 'all', status: 'all', confidence: 'all' },
    ...defaultExploreOverlayState(),
    selected: entity.id,
    ...(geoAnchor ? { viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 } } : {}),
  });
  const { data: searchIndex } = await getPublicSearchIndex();
  // Full public catalog order for entity-page Next/Random (explore spotlight uses the live map list).
  const orderedIds = searchIndex.map((doc) => doc.id);

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
        <div className="ds-entity-mast__media">
          <EntityMastMedia
            entityId={entity.id}
            entityName={entity.displayName}
            kind={entity.kind}
            {...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {})}
            {...(entity.primaryImage !== undefined ? { primaryImage: entity.primaryImage } : {})}
            priority
          />
        </div>
        <div className="ds-entity-mast__identity">
          <p className="ds-page__eyebrow">
            <span className="ds-entity-mast__meta">
              <KindBadge kind={entity.kind} {...(mapTone !== undefined ? { mapTone } : {})} />
              {jurisdictionLabel ? (
                <>
                  <span className="ds-entity-mast__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="ds-mono ds-entity-mast__meta-item">{jurisdictionLabel}</span>
                </>
              ) : null}
              <span className="ds-entity-mast__meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="ds-entity-mast__meta-item">{framingLabel}</span>
            </span>
          </p>
          <h1 className="ds-page__title">{entity.displayName}</h1>
          <LinkedProse
            className="ds-page__lede"
            text={entity.summary}
            skipEntityIds={[entity.id]}
            catalog={entityLinkCatalog}
          />
          <EntityTopicTags entity={entity} />
          <EntitySessionNavClient currentId={entity.id} orderedIds={orderedIds} />
        </div>
      </header>

      {/* Summary before story (v5.1 cognitive-accessibility law): labeled facts the mast
          does not already state, before any prose asks for sustained reading. */}
      <section className="ds-at-a-glance" aria-label="At a glance">
        <p className="ds-at-a-glance__title">At a glance</p>
        <dl className="ds-at-a-glance__grid">
          <div className="ds-at-a-glance__row">
            <dt>Evidence</dt>
            <dd>
              <Link className="ds-at-a-glance__link" href="#accepted-claims">
                {entity.claims.length} accepted claim{entity.claims.length === 1 ? '' : 's'}
              </Link>
            </dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Confidence</dt>
            <dd>
              <ConfidenceMark tier={confidenceTier} labeled />
            </dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Coverage</dt>
            <dd>{humanizeToken(entity.researchCoverage)}</dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Location shown</dt>
            <dd>
              {mapsHref ? (
                <MapsExternalLink
                  className="ds-at-a-glance__link"
                  href={mapsHref}
                  placeLabel={entity.locationLabel}
                  title={`Open ${entity.locationLabel} in your maps app`}
                >
                  {entity.locationLabel} ({entity.locationPrecision} precision)
                </MapsExternalLink>
              ) : (
                <>
                  {entity.locationLabel} ({entity.locationPrecision} precision)
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="ds-entity-body">
        <HowToReadThisRecord variant="compact" />
        {entity.sensitivity ? (
          <EntitySensitivityBanner sensitivity={entity.sensitivity} entityKind={entity.kind} />
        ) : null}

        <div className="ds-entity-layout">
          <div className="ds-stack ds-entity-sections">
            <section className="ds-record-section" aria-labelledby="relevance-heading">
              <p className="ds-section__kicker">
                <span className="ds-kicker-index" aria-hidden="true" />
                Relevance
              </p>
              <h2 className="ds-section__title" id="relevance-heading">
                Why this appears
              </h2>
              <div className="ds-record-section__body">
                {whyThisAppears ? (
                  <WhyThisAppears
                    result={whyThisAppears}
                    instanceId={`entity-${entity.id}-why`}
                    evidenceById={whyAppearsEvidenceById(entity)}
                  />
                ) : (
                  <RecordGapNotice kind="relevance" />
                )}
              </div>
            </section>

            <section className="ds-record-section" aria-labelledby="context-heading">
              <p className="ds-section__kicker">
                <span className="ds-kicker-index" aria-hidden="true" />
                Context
              </p>
              <h2 className="ds-section__title" id="context-heading">
                Historical context
              </h2>
              {entity.historicalContext.trim().length > 0 ? (
                <LinkedProse
                  className="ds-section__lede"
                  text={entity.historicalContext}
                  skipEntityIds={[entity.id]}
                  catalog={entityLinkCatalog}
                />
              ) : (
                <RecordGapNotice kind="context" />
              )}
            </section>

            {entity.extendedNarrative ? (
              <section className="ds-record-section" aria-labelledby="further-heading">
                <p className="ds-section__kicker">
                  <span className="ds-kicker-index" aria-hidden="true" />
                  Reading
                </p>
                <h2 className="ds-section__title" id="further-heading">
                  Further reading
                </h2>
                <p className="ds-section__lede">{entity.extendedNarrative}</p>
              </section>
            ) : null}

            <section className="ds-record-section" aria-labelledby="status-heading">
              <p className="ds-section__kicker">
                <span className="ds-kicker-index" aria-hidden="true" />
                Status
              </p>
              <h2 className="ds-section__title" id="status-heading">
                {entity.kind === 'event' ? 'When this happened' : 'Status and history'}
              </h2>
              <div className="ds-record-section__body">
                <EntityStatusPanel entity={entity} framing={framing} />
              </div>
            </section>

            <section
              className="ds-record-section"
              id="accepted-claims"
              aria-labelledby="claims-heading"
            >
              <p className="ds-section__kicker">
                <span className="ds-kicker-index" aria-hidden="true" />
                Claims
              </p>
              <h2 className="ds-section__title" id="claims-heading">
                Accepted claims
              </h2>
              <div className="ds-record-section__body">
                {entity.claims.length === 0 ? (
                  <RecordGapNotice kind="claims" />
                ) : (
                  <EntityEvidencePanel
                    labelledBy="claims-heading"
                    claims={evidenceClaims}
                    researchCoverage={{ level: entity.researchCoverage }}
                  />
                )}
              </div>
            </section>

            {entity.timeline.length > 0 ? (
              <section className="ds-record-section" aria-labelledby="timeline-heading">
                <p className="ds-section__kicker">
                  <span className="ds-kicker-index" aria-hidden="true" />
                  Chronology
                </p>
                <h2 className="ds-section__title" id="timeline-heading">
                  Timeline
                </h2>
                <div className="ds-record-section__body">
                  <Timeline labelledBy="timeline-heading" items={entity.timeline} />
                </div>
                <p className="ds-entity-footnote ds-sans">
                  Dated status changes and relationship timespans published for this record.
                </p>
              </section>
            ) : null}

            <section className="ds-record-section" aria-labelledby="related-heading">
              <p className="ds-section__kicker">
                <span className="ds-kicker-index" aria-hidden="true" />
                Connected
              </p>
              <h2 className="ds-section__title" id="related-heading">
                Connected records
              </h2>
              <EntityLinkDiscoveryHint />
              <div className="ds-record-section__body">
                <EntityRelatedList entity={entity} labelledBy="related-heading" />
              </div>
              {continueLearning.length > 0 ? (
                <div className="ds-record-section__nested" aria-labelledby="continue-heading">
                  <h3 className="ds-subheading" id="continue-heading">
                    Also connected
                  </h3>
                  <p className="ds-section__lede">
                    Nearby records one step further in the published graph — keep learning without
                    dead ends.
                  </p>
                  <EntityRelatedList
                    entity={entity}
                    labelledBy="continue-heading"
                    continueLearning
                  />
                </div>
              ) : null}
            </section>
          </div>

          <aside className="ds-entity-aside" aria-label="Record context">
            {geoAnchor ? (
              <EntityLocationMapLazy
                lat={geoAnchor.lat}
                lng={geoAnchor.lng}
                label={entity.locationLabel}
                precision={entity.locationPrecision}
                caption="Public-precision street context (OpenStreetMap). Not survey-grade — use Open in maps for Google, Apple, or your default maps app."
              />
            ) : (
              <MapFrame
                title={`${entity.displayName} map context`}
                caption="No public coordinates for this record yet. Open the national map to browse nearby archive geography."
                pins={[
                  {
                    id: entity.id,
                    label: entity.displayName,
                    x: entity.mapPin.x,
                    y: entity.mapPin.y,
                  },
                ]}
              />
            )}
            <p className="ds-entity-aside__cta">
              {mapsHref ? (
                <MapsExternalLink
                  className="ds-cta ds-cta--copper"
                  href={mapsHref}
                  placeLabel={entity.locationLabel}
                  title={`Open ${entity.locationLabel} in your maps app`}
                >
                  Open in maps
                </MapsExternalLink>
              ) : null}
              <Link className="ds-cta ds-cta--ink" href={exploreHref} scroll={false}>
                View on national map
              </Link>
            </p>
            <p className="ds-entity-aside__precision ds-sans">
              Location precision: <strong>{entity.locationPrecision}</strong>. Showing{' '}
              {entity.locationLabel}. Exact residential addresses are never rendered on public
              pages.
            </p>

            <section className="ds-aside-block" aria-labelledby="maturity-heading">
              <h2 className="ds-aside-block__title" id="maturity-heading">
                Record maturity
              </h2>
              <p className="ds-aside-block__meta ds-mono">
                {humanizeToken(entity.recordMaturity)}
              </p>
              <p className="ds-sans" style={{ margin: 0 }}>
                Research coverage: <strong>{humanizeToken(entity.researchCoverage)}</strong>.
                Maturity labels follow the product constitution vocabulary.
              </p>
            </section>

            <section className="ds-aside-block" aria-labelledby="revision-heading">
              <h2 className="ds-aside-block__title" id="revision-heading">
                Revision
              </h2>
              <p className="ds-aside-block__meta ds-mono">{entity.revision.releaseId}</p>
              <dl className="ds-entity-meta-list">
                <div className="ds-entity-meta-list__row">
                  <dt>Record last updated</dt>
                  <dd>{entity.revision.recordUpdatedAt || 'Not yet tracked'}</dd>
                </div>
                <div className="ds-entity-meta-list__row">
                  <dt>Release generated</dt>
                  <dd>{entity.revision.generatedAt || 'Not yet tracked'}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
