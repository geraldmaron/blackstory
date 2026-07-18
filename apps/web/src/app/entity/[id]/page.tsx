/**
 * Entity detail page for place/school/event/institution public records. Shared layout,
 * type-specific sections: relevance, historical context, status,
 * accepted claims via EntityEvidencePanel, graph-derived related records and
 * timeline, location precision, record maturity, revision metadata, and a sensitivity
 * context banner when the record carries one. Sparse sections render the approved
 * `RecordGapNotice` copy instead of a silent empty list.
 */

import { notFound } from 'next/navigation';
import { buildCompactFactViewsForEntity } from '@repo/domain';
import { MapFrame, Notice, Timeline } from '@repo/ui';
import { SeedDataNotice } from '../../../components/SeedDataNotice';
import { KindBadge, ConfidenceMark } from '../../../components/map-experience';
import { EntitySensitivityBanner } from '../../../components/entity/EntitySensitivityBanner';
import '../../../components/entity/entity-page.css';
import { EntityStatusPanel } from '../../../components/entity/EntityStatusPanel';
import { EntityRelatedList } from '../../../components/entity/EntityRelatedList';
import { EntityLinkDiscoveryHint } from '../../../components/entity/EntityLink';
import { EntityTopicTags } from '../../../components/entity/EntityTopicTags';
import { EntityPrimaryImage } from '../../../components/entity/EntityPrimaryImage';
import { EntityArchiveCollage } from '../../../components/entity/EntityArchiveCollage';
import { RecordGapNotice } from '../../../components/entity/RecordGapNotice';
import { EntityEvidencePanel } from '../../../components/evidence';
import { CompactFactReference } from '../../../components/facts';
import { HowToReadThisRecord } from '../../../components/trust';
import { WhyThisAppears } from '../../../components/why-appears';
import { seedFactsForEntity } from '../../../data/facts-seed';
import { buildExploreHref, geoAnchorFor, highestConfidence, mapToneFromTopics } from '../../../lib/map-experience';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import { listPublicEntityViews, resolvePublicEntityView } from '../../../lib/public-data/source';
import { buildWhyThisAppearsForEntity, toEvidenceClaimInputs } from './adapters';
import { deriveHistoricalFraming } from './entity-view-model';

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

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
  const exploreHref = buildExploreHref({
    filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
    density: false,
    group: false,
    lines: false,
    selected: entity.id,
    ...(geoAnchor
      ? { viewport: { lat: geoAnchor.lat, lng: geoAnchor.lng, zoom: 11 } }
      : {}),
  });

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
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
        <p className="ds-page__lede">{entity.summary}</p>
        <EntityTopicTags entity={entity} />
      </header>

      {/* Summary before story (v5.1 cognitive-accessibility law): the whole
          record as labeled facts, before any prose asks for sustained reading. */}
      <section className="ds-at-a-glance" aria-label="At a glance">
        <p className="ds-at-a-glance__title">At a glance</p>
        <dl className="ds-at-a-glance__grid">
          <div className="ds-at-a-glance__row">
            <dt>Kind</dt>
            <dd>
              <KindBadge
                kind={entity.kind}
                {...(mapTone !== undefined ? { mapTone } : {})}
              />
            </dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Where</dt>
            <dd>{entity.jurisdictionLabel}</dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Record type</dt>
            <dd>{framingLabel}</dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Evidence</dt>
            <dd>
              {entity.claims.length} accepted claim{entity.claims.length === 1 ? '' : 's'}
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
              {entity.locationLabel} ({entity.locationPrecision} precision)
            </dd>
          </div>
        </dl>
      </section>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-6)' }}>
        {resolved.source !== 'live' ? <SeedDataNotice compact /> : null}
        <HowToReadThisRecord />

        {entity.sensitivity ? (
          <EntitySensitivityBanner sensitivity={entity.sensitivity} entityKind={entity.kind} />
        ) : null}

        <div className="ds-entity-layout">
          <div className="ds-stack ds-entity-sections">
            <section className="ds-record-section" aria-labelledby="relevance-heading">
              <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Relevance</p>
              <h2 className="ds-section__title" id="relevance-heading">
                Why this appears
              </h2>
              <div style={{ marginTop: 'var(--ds-space-4)' }}>
                {whyThisAppears ? (
                  <WhyThisAppears result={whyThisAppears} instanceId={`entity-${entity.id}-why`} />
                ) : (
                  <RecordGapNotice kind="relevance" />
                )}
              </div>
            </section>

            <section className="ds-record-section" aria-labelledby="context-heading">
              <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Context</p>
              <h2 className="ds-section__title" id="context-heading">
                Historical context
              </h2>
              {entity.historicalContext.trim().length > 0 ? (
                <p className="ds-section__lede">{entity.historicalContext}</p>
              ) : (
                <RecordGapNotice kind="context" />
              )}
            </section>

            {entity.extendedNarrative ? (
              <section className="ds-record-section" aria-labelledby="further-heading">
                <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Reading</p>
                <h2 className="ds-section__title" id="further-heading">
                  Further reading
                </h2>
                <p className="ds-section__lede">{entity.extendedNarrative}</p>
              </section>
            ) : null}

            <section className="ds-record-section" aria-labelledby="status-heading">
              <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Status</p>
              <h2 className="ds-section__title" id="status-heading">
                {entity.kind === 'event' ? 'When this happened' : 'Status and history'}
              </h2>
              <div style={{ marginTop: 'var(--ds-space-4)' }}>
                <EntityStatusPanel entity={entity} framing={framing} />
              </div>
            </section>

            <section className="ds-record-section" aria-labelledby="claims-heading">
              <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Claims</p>
              <h2 className="ds-section__title" id="claims-heading">
                Accepted claims
              </h2>
              <div style={{ marginTop: 'var(--ds-space-4)' }}>
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

            {relatedFacts.length > 0 ? (
              <section className="ds-record-section" aria-labelledby="facts-heading">
                <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Facts</p>
                <h2 className="ds-section__title" id="facts-heading">
                  Related fact records
                </h2>
                <div className="ds-stack" style={{ marginTop: 'var(--ds-space-4)' }}>
                  {relatedFacts.map((view) => (
                    <CompactFactReference key={view.id} view={view} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="ds-record-section" aria-labelledby="timeline-heading">
              <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Chronology</p>
              <h2 className="ds-section__title" id="timeline-heading">
                Timeline
              </h2>
              <div style={{ marginTop: 'var(--ds-space-4)' }}>
                {entity.timeline.length === 0 ? (
                  <RecordGapNotice kind="timeline" />
                ) : (
                  <Timeline labelledBy="timeline-heading" items={entity.timeline} />
                )}
              </div>
              <p className="ds-sans" style={{ color: 'var(--ds-ink-muted)', marginTop: 'var(--ds-space-2)' }}>
                Derived from this record&rsquo;s published history graph and status
                history — never hand-authored prose.
              </p>
            </section>

            <section className="ds-record-section" aria-labelledby="related-heading">
              <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />More</p>
              <h2 className="ds-section__title" id="related-heading">
                Related records
              </h2>
              <EntityLinkDiscoveryHint />
              <div style={{ marginTop: 'var(--ds-space-4)' }}>
                <EntityRelatedList entity={entity} labelledBy="related-heading" />
              </div>
            </section>

            {(entity.continueLearning?.length ?? 0) > 0 ? (
              <section className="ds-record-section" aria-labelledby="continue-heading">
                <p className="ds-section__kicker"><span className="ds-kicker-index" aria-hidden="true" />Continue</p>
                <h2 className="ds-section__title" id="continue-heading">
                  Also connected
                </h2>
                <p className="ds-section__lede">
                  Nearby records one step further in the published graph — keep learning without
                  dead ends.
                </p>
                <EntityLinkDiscoveryHint />
                <div style={{ marginTop: 'var(--ds-space-4)' }}>
                  <EntityRelatedList
                    entity={entity}
                    labelledBy="continue-heading"
                    continueLearning
                  />
                </div>
              </section>
            ) : null}
          </div>

          <aside className="ds-entity-aside" aria-label="Record context">
            {entity.primaryImage ? (
              <EntityPrimaryImage image={entity.primaryImage} entityName={entity.displayName} />
            ) : (
              <EntityArchiveCollage
                entityId={entity.id}
                entityName={entity.displayName}
                kind={entity.kind}
              />
            )}

            <Notice tone="warning" title={`Location precision: ${entity.locationPrecision}`}>
              Showing {entity.locationLabel}. Exact residential addresses are never rendered on
              public pages.
            </Notice>

            <section className="ds-aside-block" aria-labelledby="maturity-heading">
              <h2 className="ds-aside-block__title" id="maturity-heading">
                Record maturity
              </h2>
              <p className="ds-aside-block__meta ds-mono">{entity.recordMaturity}</p>
              <p className="ds-sans" style={{ margin: 0 }}>
                Research coverage: <strong>{entity.researchCoverage}</strong>. Maturity labels
                follow the product constitution vocabulary and will be projection-backed in a later release.
              </p>
            </section>

            <section className="ds-aside-block" aria-labelledby="revision-heading">
              <h2 className="ds-aside-block__title" id="revision-heading">
                Revision
              </h2>
              <p className="ds-aside-block__meta ds-mono">{entity.revision.releaseId}</p>
              <dl className="ds-sans" style={{ margin: 0 }}>
                <dt style={{ fontWeight: 600 }}>Record last updated</dt>
                <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>
                  {entity.revision.recordUpdatedAt || 'Not yet tracked'}
                </dd>
                <dt style={{ fontWeight: 600 }}>Release generated</dt>
                <dd style={{ margin: 0 }}>{entity.revision.generatedAt || 'Not yet tracked'}</dd>
              </dl>
            </section>

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
            <p style={{ margin: 0 }}>
              <a className="ds-cta ds-cta--ink" href={exploreHref}>
                View on map
              </a>
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
