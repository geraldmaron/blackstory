/**
 * Entity detail body: v6 edition Surface panels for relevance, context, status,
 * claims, timeline, connected records, and provenance.
 */
import React from 'react';
import { Timeline } from '@repo/ui';
import type { PublicEntityView } from '../../../data/public-seed';
import Link from 'next/link';
import type { PublicWhyThisAppears } from '@repo/domain';
import type { EvidenceClaimInput } from '../../../lib/evidence';
import type { WhyAppearsEvidenceCitation } from './adapters';
import {
  entityCrossReferenceHref,
  entityCrossReferenceLabel,
  type EntityCrossReferenceSurface,
} from '../../../lib/theme-impact/source';
import { EntityEvidencePanel } from '../../../components/evidence';
import { WhyThisAppears } from '../../../components/why-appears';
import { EntityStatusPanel } from '../../../components/entity/EntityStatusPanel';
import { EntityRelatedList } from '../../../components/entity/EntityRelatedList';
import { EntityLinkDiscoveryHint } from '../../../components/entity/EntityLink';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { RecordGapNotice } from '../../../components/entity/RecordGapNotice';
import { humanizeToken } from '../../../components/entity/format';
import type { HistoricalFraming } from './entity-view-model';
import { entityEditionPanelClassName } from './entity-panel-chrome';

void React;

export type EntityEditionSectionsProps = {
  readonly entity: PublicEntityView;
  readonly framing: HistoricalFraming;
  readonly whyThisAppears: PublicWhyThisAppears | undefined;
  readonly whyAppearsEvidenceById: Readonly<Record<string, WhyAppearsEvidenceCitation>>;
  readonly evidenceClaims: readonly EvidenceClaimInput[];
  readonly entityLinkCatalog: readonly EntityLinkCatalogEntry[];
  /** Chapters/stories/theme packets this entity appears on elsewhere (repo-cqey.8). Optional —
   * an entity with zero cross-references renders no "Appears in" panel at all. */
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
};

function entityBeatIndices(
  entity: PublicEntityView,
  hasCrossReferences: boolean,
) {
  let current = 2;
  const next = () => String(current++).padStart(2, '0');
  const relevance = next();
  const context = next();
  const reading = entity.extendedNarrative ? next() : undefined;
  const status = next();
  const claims = next();
  const timeline = entity.timeline.length > 0 ? next() : undefined;
  const connected = next();
  const appearsIn = hasCrossReferences ? next() : undefined;
  const provenance = next();
  return { relevance, context, reading, status, claims, timeline, connected, appearsIn, provenance };
}

export function EntityEditionSections({
  entity,
  framing,
  whyThisAppears,
  whyAppearsEvidenceById,
  evidenceClaims,
  entityLinkCatalog,
  crossReferences = [],
}: EntityEditionSectionsProps) {
  const continueLearning = entity.continueLearning ?? [];
  const statusHeading =
    entity.kind === 'event' ? 'When this happened' : 'Status and history';
  const beats = entityBeatIndices(entity, crossReferences.length > 0);

  return (
    <>
      <article
        className={entityEditionPanelClassName('relevance')}
        aria-labelledby="relevance-heading"
      >
        <header className="ds-entity-edition__header">
          <span className="ds-entity-edition__index" aria-hidden="true">
            {beats.relevance}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Relevance</p>
            <h2 className="ds-entity-edition__panel-heading" id="relevance-heading">
              Why this appears
            </h2>
          </div>
        </header>
        <div className="ds-entity-edition__section-body">
          {whyThisAppears ? (
            <WhyThisAppears
              result={whyThisAppears}
              instanceId={`entity-${entity.id}-why`}
              evidenceById={whyAppearsEvidenceById}
            />
          ) : (
            <RecordGapNotice kind="relevance" />
          )}
        </div>
      </article>

      <article
        className={entityEditionPanelClassName('context')}
        aria-labelledby="context-heading"
      >
        <header className="ds-entity-edition__header">
          <span className="ds-entity-edition__index" aria-hidden="true">
            {beats.context}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Context</p>
            <h2 className="ds-entity-edition__panel-heading" id="context-heading">
              Historical context
            </h2>
          </div>
        </header>
        {entity.historicalContext.trim().length > 0 ? (
          <LinkedProse
            className="ds-entity-edition__body"
            text={entity.historicalContext}
            skipEntityIds={[entity.id]}
            catalog={entityLinkCatalog}
          />
        ) : (
          <RecordGapNotice kind="context" />
        )}
      </article>

      {entity.extendedNarrative ? (
        <article
          className={entityEditionPanelClassName('reading')}
          aria-labelledby="further-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {beats.reading}
            </span>
            <div>
              <p className="ds-entity-edition__kicker">Reading</p>
              <h2 className="ds-entity-edition__panel-heading" id="further-heading">
                Further reading
              </h2>
            </div>
          </header>
          <p className="ds-entity-edition__body">{entity.extendedNarrative}</p>
        </article>
      ) : null}

      <article
        className={entityEditionPanelClassName('status')}
        aria-labelledby="status-heading"
      >
        <header className="ds-entity-edition__header">
          <span className="ds-entity-edition__index" aria-hidden="true">
            {beats.status}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Status</p>
            <h2 className="ds-entity-edition__panel-heading" id="status-heading">
              {statusHeading}
            </h2>
          </div>
        </header>
        <div className="ds-entity-edition__section-body">
          <EntityStatusPanel entity={entity} framing={framing} />
        </div>
      </article>

      <article
        className={entityEditionPanelClassName('claims')}
        id="accepted-claims"
        aria-labelledby="claims-heading"
      >
        <header className="ds-entity-edition__header">
          <span className="ds-entity-edition__index" aria-hidden="true">
            {beats.claims}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Claims</p>
            <h2 className="ds-entity-edition__panel-heading" id="claims-heading">
              Accepted claims
            </h2>
          </div>
        </header>
        <div className="ds-entity-edition__section-body">
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
      </article>

      {entity.timeline.length > 0 ? (
        <article
          className={entityEditionPanelClassName('timeline')}
          aria-labelledby="timeline-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {beats.timeline}
            </span>
            <div>
              <p className="ds-entity-edition__kicker">Chronology</p>
              <h2 className="ds-entity-edition__panel-heading" id="timeline-heading">
                Timeline
              </h2>
            </div>
          </header>
          <div className="ds-entity-edition__section-body">
            <Timeline labelledBy="timeline-heading" items={entity.timeline} />
          </div>
          <p className="ds-entity-edition__footnote">
            Dated status changes and relationship timespans published for this record.
          </p>
        </article>
      ) : null}

      <article
        className={entityEditionPanelClassName('connected')}
        aria-labelledby="related-heading"
      >
        <header className="ds-entity-edition__header">
          <span className="ds-entity-edition__index" aria-hidden="true">
            {beats.connected}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Connected</p>
            <h2 className="ds-entity-edition__panel-heading" id="related-heading">
              Connected records
            </h2>
          </div>
        </header>
        <EntityLinkDiscoveryHint />
        <div className="ds-entity-edition__section-body">
          <EntityRelatedList entity={entity} labelledBy="related-heading" />
        </div>
        {continueLearning.length > 0 ? (
          <div className="ds-entity-edition__nested" aria-labelledby="continue-heading">
            <h3 className="ds-entity-edition__nested-heading" id="continue-heading">
              Also connected
            </h3>
            <p className="ds-entity-edition__lede">
              Nearby records one step further in the published graph: keep learning without dead
              ends.
            </p>
            <EntityRelatedList
              entity={entity}
              labelledBy="continue-heading"
              continueLearning
            />
          </div>
        ) : null}
      </article>

      {crossReferences.length > 0 ? (
        <article
          className={entityEditionPanelClassName('appears-in')}
          aria-labelledby="appears-in-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {beats.appearsIn}
            </span>
            <div>
              <p className="ds-entity-edition__kicker">Appears in</p>
              <h2 className="ds-entity-edition__panel-heading" id="appears-in-heading">
                Elsewhere in the archive
              </h2>
              <p className="ds-entity-edition__lede">
                Chapters and theme instruments that reference this record.
              </p>
            </div>
          </header>
          <ul className="ds-entity-edition__appears-in-list" aria-label="Appears in">
            {crossReferences.map((surface) => (
              <li key={`${surface.kind}-${entityCrossReferenceHref(surface)}`}>
                <Link href={entityCrossReferenceHref(surface)}>
                  {entityCrossReferenceLabel(surface)}
                </Link>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article
        className={entityEditionPanelClassName('provenance')}
        aria-labelledby="provenance-heading"
      >
        <header className="ds-entity-edition__header">
          <span className="ds-entity-edition__index" aria-hidden="true">
            {beats.provenance}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Provenance</p>
            <h2 className="ds-entity-edition__panel-heading" id="provenance-heading">
              Record maturity and revision
            </h2>
          </div>
        </header>
        <p className="ds-entity-edition__body">
          Maturity: <strong>{humanizeToken(entity.recordMaturity)}</strong>. Research coverage:{' '}
          <strong>{humanizeToken(entity.researchCoverage)}</strong>. Maturity labels follow the
          product constitution vocabulary.
        </p>
        <p className="ds-entity-edition__footnote ds-mono">{entity.revision.releaseId}</p>
        <dl className="ds-entity-edition__meta-list">
          <div className="ds-entity-edition__meta-list-row">
            <dt>Record last updated</dt>
            <dd>{entity.revision.recordUpdatedAt || 'Not yet tracked'}</dd>
          </div>
          <div className="ds-entity-edition__meta-list-row">
            <dt>Release generated</dt>
            <dd>{entity.revision.generatedAt || 'Not yet tracked'}</dd>
          </div>
        </dl>
      </article>
    </>
  );
}
