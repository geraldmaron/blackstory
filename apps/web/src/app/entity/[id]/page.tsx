/**
 * Entity detail page for place/school/event/institution public records. Editorial mast
 * (media plane + name + serif summary) leads; slim at-a-glance labeled facts follow before
 * sustained reading. Main spine: relevance, historical context, status, accepted claims,
 * timeline, and unified connected records. Slim context rail: map, maturity, revision.
 * Sparse sections render the approved `RecordGapNotice` copy instead of a silent empty list.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildCompactFactViewsForEntity } from '@repo/domain/facts';
import { findUsStateForPoint } from '@repo/domain/map/geography';
import { MapFrame, Timeline } from '@repo/ui';
import { KindBadge, ConfidenceMark } from '../../../components/map-experience';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import '../../../components/entity/entity-page.css';
import { EntityStatusPanel } from '../../../components/entity/EntityStatusPanel';
import { EntityRelatedList } from '../../../components/entity/EntityRelatedList';
import { EntityLinkDiscoveryHint } from '../../../components/entity/EntityLink';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import { EntityMastMedia } from '../../../components/entity/EntityMastMedia';
import { RecordGapNotice } from '../../../components/entity/RecordGapNotice';
import { EntityEvidencePanel } from '../../../components/evidence';
import { CompactFactReference } from '../../../components/facts';
import { HowToReadThisRecord } from '../../../components/trust';
import { WhyThisAppears } from '../../../components/why-appears';
import { seedFactsForEntity } from '../../../data/facts-seed';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { exploreHrefForState } from '../../../lib/map-experience/metadata-hrefs';
import { buildExploreHref, defaultExploreOverlayState } from '../../../lib/map-experience/url-state';
import { highestConfidence } from '../../../lib/map-experience/build-explore-map-source';
import { mapToneFromTopics } from '../../../lib/map-experience/kind-encoding';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import { listPublicEntityViews, resolvePublicEntityView } from '../../../lib/public-data/source';
import {
  buildWhyThisAppearsForEntity,
  toEvidenceClaimInputs,
  whyAppearsEvidenceById,
} from './adapters';
import { deriveHistoricalFraming } from './entity-view-model';

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

function statePostalForEntity(entityId: string): string | undefined {
  const anchor = geoAnchorFor(entityId);
  if (!anchor) {
    return undefined;
  }
  return findUsStateForPoint(anchor.lat, anchor.lng)?.postalCode;
}

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
  const { data: entities } = await listPublicEntityViews();
  return entities.map((entity) => ({ id: entity.id }));
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
  const relatedFacts = buildCompactFactViewsForEntity(entity.id, seedFactsForEntity(entity.id));
  const geoAnchor = geoAnchorFor(entity.id);
  const statePostal = statePostalForEntity(entity.id);
  const entityLinkCatalog = entityLinkCatalogFromNeighbors(entity);
  const continueLearning = entity.continueLearning ?? [];
  const exploreHref = buildExploreHref({
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    ...defaultExploreOverlayState(),
    selected: entity.id,
    ...(geoAnchor
      ? { viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 } }
      : {}),
  });

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
        <div className="ds-entity-mast__media">
          <EntityMastMedia
            entityId={entity.id}
            entityName={entity.displayName}
            kind={entity.kind}
            jurisdictionLabel={entity.jurisdictionLabel}
            {...(entity.primaryImage !== undefined ? { primaryImage: entity.primaryImage } : {})}
            priority
          />
        </div>
        <div className="ds-entity-mast__identity">
          <p className="ds-page__eyebrow">
            <span className="ds-entity-mast__meta">
              <KindBadge
                kind={entity.kind}
                {...(mapTone !== undefined ? { mapTone } : {})}
              />
              <span className="ds-entity-mast__meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="ds-mono ds-entity-mast__meta-item">{entity.jurisdictionLabel}</span>
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
            <dd>{entity.researchCoverage}</dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Location shown</dt>
            <dd>
              {statePostal ? (
                <Link className="ds-at-a-glance__link" href={exploreHrefForState(statePostal)}>
                  {entity.locationLabel} ({entity.locationPrecision} precision)
                </Link>
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
              {relatedFacts.length > 0 ? (
                <div className="ds-record-section__nested" aria-labelledby="facts-heading">
                  <h3 className="ds-subheading" id="facts-heading">
                    Related fact records
                  </h3>
                  <div className="ds-stack">
                    {relatedFacts.map((view) => (
                      <CompactFactReference key={view.id} view={view} />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="ds-record-section" aria-labelledby="timeline-heading">
              <p className="ds-section__kicker">
                <span className="ds-kicker-index" aria-hidden="true" />
                Chronology
              </p>
              <h2 className="ds-section__title" id="timeline-heading">
                Timeline
              </h2>
              <div className="ds-record-section__body">
                {entity.timeline.length === 0 ? (
                  <RecordGapNotice kind="timeline" />
                ) : (
                  <Timeline labelledBy="timeline-heading" items={entity.timeline} />
                )}
              </div>
              <p className="ds-entity-footnote ds-sans">
                Derived from this record&rsquo;s published history graph and status history.
              </p>
            </section>

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
            <MapFrame
              title={`${entity.displayName} map context`}
              caption="Schematic pin — not survey-grade geometry. Open the national map for the live geographic context."
              pins={[
                {
                  id: entity.id,
                  label: entity.displayName,
                  x: entity.mapPin.x,
                  y: entity.mapPin.y,
                },
              ]}
            />
            <p className="ds-entity-aside__cta">
              <Link className="ds-cta ds-cta--ink" href={exploreHref} scroll={false}>
                View on map
              </Link>
            </p>
            <p className="ds-entity-aside__precision ds-sans">
              Location precision: <strong>{entity.locationPrecision}</strong>. Showing{' '}
              {entity.locationLabel}. Exact residential addresses are never rendered on public pages.
            </p>

            <section className="ds-aside-block" aria-labelledby="maturity-heading">
              <h2 className="ds-aside-block__title" id="maturity-heading">
                Record maturity
              </h2>
              <p className="ds-aside-block__meta ds-mono">{entity.recordMaturity}</p>
              <p className="ds-sans" style={{ margin: 0 }}>
                Research coverage: <strong>{entity.researchCoverage}</strong>. Maturity labels
                follow the product constitution vocabulary.
              </p>
            </section>

            <section className="ds-aside-block" aria-labelledby="revision-heading">
              <h2 className="ds-aside-block__title" id="revision-heading">
                Revision
              </h2>
              <p className="ds-aside-block__meta ds-mono">{entity.revision.releaseId}</p>
              <dl className="ds-sans" style={{ margin: 0 }}>
                <dt className="ds-dt">Record last updated</dt>
                <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>
                  {entity.revision.recordUpdatedAt || 'Not yet tracked'}
                </dd>
                <dt className="ds-dt">Release generated</dt>
                <dd style={{ margin: 0 }}>{entity.revision.generatedAt || 'Not yet tracked'}</dd>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
