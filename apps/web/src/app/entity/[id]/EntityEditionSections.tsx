/**
 * Entity detail body: v6 edition Surface panels for context, relevance, status,
 * claims, timeline, connected records, and provenance.
 *
 * Adaptive stack: a content beat renders only when the record actually has that
 * content. Research gaps are disclosed once, in the closing "About this record"
 * panel, using the approved `RECORD_GAP_COPY` vocabulary, never as a run of
 * per-section apology cards on sparse records.
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
import { RECORD_GAP_COPY, type RecordGapKind } from '../../../components/entity/copy';
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
  /** Chapters/stories/theme packets this entity appears on elsewhere (repo-cqey.8). Optional:
   * an entity with zero cross-references renders no "Appears in" panel at all. */
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
};

type SectionPresence = {
  readonly hasContext: boolean;
  readonly hasRelevance: boolean;
  readonly hasReading: boolean;
  readonly hasStatus: boolean;
  readonly hasClaims: boolean;
  readonly hasTimeline: boolean;
  readonly hasConnected: boolean;
};

function resolveSectionPresence(
  entity: PublicEntityView,
  whyThisAppears: PublicWhyThisAppears | undefined,
): SectionPresence {
  const hasStatus =
    entity.kind === 'event'
      ? entity.eventWindow !== undefined
      : Boolean(entity.status) || (entity.statusHistory?.length ?? 0) > 0;
  return {
    hasContext: entity.historicalContext.trim().length > 0,
    hasRelevance: whyThisAppears !== undefined,
    hasReading: Boolean(entity.extendedNarrative),
    hasStatus,
    hasClaims: entity.claims.length > 0,
    hasTimeline: entity.timeline.length > 0,
    hasConnected:
      (entity.relatedNeighbors?.length ?? 0) > 0 ||
      (entity.related?.length ?? 0) > 0 ||
      (entity.continueLearning?.length ?? 0) > 0,
  };
}

/** Gap disclosures for the "About this record" panel, in reading order. */
function resolveResearchGaps(presence: SectionPresence): readonly RecordGapKind[] {
  const gaps: RecordGapKind[] = [];
  if (!presence.hasContext) gaps.push('context');
  if (!presence.hasRelevance) gaps.push('relevance');
  if (!presence.hasStatus) gaps.push('statusHistory');
  if (!presence.hasClaims) gaps.push('claims');
  if (!presence.hasTimeline) gaps.push('timeline');
  if (!presence.hasConnected) gaps.push('related');
  return gaps;
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
  const presence = resolveSectionPresence(entity, whyThisAppears);
  const researchGaps = resolveResearchGaps(presence);

  let beatCursor = 2;
  const nextBeat = () => String(beatCursor++).padStart(2, '0');

  return (
    <>
      {presence.hasContext ? (
        <article
          className={entityEditionPanelClassName('context')}
          aria-labelledby="context-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
            </span>
            <div>
              <p className="ds-entity-edition__kicker">Context</p>
              <h2 className="ds-entity-edition__panel-heading" id="context-heading">
                Historical context
              </h2>
            </div>
          </header>
          <LinkedProse
            className="ds-entity-edition__body"
            text={entity.historicalContext}
            skipEntityIds={[entity.id]}
            catalog={entityLinkCatalog}
          />
        </article>
      ) : null}

      {presence.hasReading ? (
        <article
          className={entityEditionPanelClassName('reading')}
          aria-labelledby="further-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
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

      {presence.hasRelevance && whyThisAppears ? (
        <article
          className={entityEditionPanelClassName('relevance')}
          aria-labelledby="relevance-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
            </span>
            <div>
              <p className="ds-entity-edition__kicker">Relevance</p>
              <h2 className="ds-entity-edition__panel-heading" id="relevance-heading">
                Why this appears
              </h2>
            </div>
          </header>
          <div className="ds-entity-edition__section-body">
            <WhyThisAppears
              result={whyThisAppears}
              instanceId={`entity-${entity.id}-why`}
              evidenceById={whyAppearsEvidenceById}
            />
          </div>
        </article>
      ) : null}

      {presence.hasStatus ? (
        <article
          className={entityEditionPanelClassName('status')}
          aria-labelledby="status-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
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
      ) : null}

      {presence.hasClaims ? (
        <article
          className={entityEditionPanelClassName('claims')}
          id="accepted-claims"
          aria-labelledby="claims-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
            </span>
            <div>
              <p className="ds-entity-edition__kicker">Claims</p>
              <h2 className="ds-entity-edition__panel-heading" id="claims-heading">
                Accepted claims
              </h2>
            </div>
          </header>
          <div className="ds-entity-edition__section-body">
            <EntityEvidencePanel
              labelledBy="claims-heading"
              claims={evidenceClaims}
              researchCoverage={{ level: entity.researchCoverage }}
            />
          </div>
        </article>
      ) : null}

      {presence.hasTimeline ? (
        <article
          className={entityEditionPanelClassName('timeline')}
          aria-labelledby="timeline-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
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

      {presence.hasConnected ? (
        <article
          className={entityEditionPanelClassName('connected')}
          aria-labelledby="related-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
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
      ) : null}

      {crossReferences.length > 0 ? (
        <article
          className={entityEditionPanelClassName('appears-in')}
          aria-labelledby="appears-in-heading"
        >
          <header className="ds-entity-edition__header">
            <span className="ds-entity-edition__index" aria-hidden="true">
              {nextBeat()}
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
                <Link href={entityCrossReferenceHref(surface)} prefetch={false}>
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
            {nextBeat()}
          </span>
          <div>
            <p className="ds-entity-edition__kicker">Provenance</p>
            <h2 className="ds-entity-edition__panel-heading" id="provenance-heading">
              About this record
            </h2>
          </div>
        </header>
        <p className="ds-entity-edition__body">
          Maturity: <strong>{humanizeToken(entity.recordMaturity)}</strong>. Research coverage:{' '}
          <strong>{humanizeToken(entity.researchCoverage)}</strong>. Maturity labels follow the
          product constitution vocabulary.
        </p>
        {researchGaps.length > 0 ? (
          <div className="ds-entity-edition__coverage" aria-labelledby="coverage-heading">
            <h3 className="ds-entity-edition__nested-heading" id="coverage-heading">
              Still being researched
            </h3>
            <ul className="ds-entity-edition__coverage-list">
              {researchGaps.map((gap) => (
                <li key={gap}>{RECORD_GAP_COPY[gap].title}</li>
              ))}
            </ul>
            <p className="ds-entity-edition__footnote">
              These gaps reflect the current state of research, not an absence of history.
              Coverage deepens as research continues.
            </p>
          </div>
        ) : null}
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
