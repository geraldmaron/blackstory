/**
 * The record room's column: what is known about this record, in reading order.
 *
 * This replaces the v6 edition stack, which rendered every beat as a numbered panel (00 RECORD,
 * 01 ANATOMY, 02 CONTEXT, 03 RELEVANCE, 04 STATUS, 05 CLAIMS, 06 PROVENANCE) inside its own
 * bordered card. Six chapter numbers is a promise of six chapters, and most records have one
 * sourced paragraph and a location, so the page read as a filing cabinet: identical grey boxes,
 * each announcing itself, several of them apologising for being empty.
 *
 * What is here instead: the orientation facts and the evidence apparatus move to the rail (see
 * page.tsx), and the column carries only prose a person would actually read, under plain
 * headings. A beat still renders only when the record has that content, and the gaps are
 * disclosed once, in the rail, using the approved `RECORD_GAP_COPY` vocabulary.
 *
 * The summary is not repeated. It is the lede, in the header, and nowhere else: the v6 page
 * printed the same sentence as the lede, again as "Inclusion evidence", and a third time as the
 * accepted claim. The claim keeps it, because that is the copy that carries a citation.
 */
import React from 'react';
import Link from 'next/link';
import { Timeline } from '@repo/ui';
import type { PublicEntityView } from '../../../data/public-seed';
import type { EvidenceClaimInput } from '../../../lib/evidence';
import {
  entityCrossReferenceHref,
  entityCrossReferenceLabel,
  type EntityCrossReferenceSurface,
} from '../../../lib/theme-impact/source';
import { EntityEvidencePanel } from '../../../components/evidence';
import { EntityStatusPanel } from '../../../components/entity/EntityStatusPanel';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { Connections, type RoomConnection } from '../../../components/room';
import { humanizeToken } from '../../../components/entity/format';
import type { HistoricalFraming } from './entity-view-model';

void React;

export type EntityRoomSectionsProps = {
  readonly entity: PublicEntityView;
  readonly framing: HistoricalFraming;
  readonly evidenceClaims: readonly EvidenceClaimInput[];
  readonly entityLinkCatalog: readonly EntityLinkCatalogEntry[];
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
};

/**
 * A relation in words, which is the rule the kit's `Connections` enforces: a related record is
 * useless as "related", and a bare arrow is worse. `relationType` is a graph edge token
 * (`co_participant`, `located_in`), so it is humanised and given the direction it was stored
 * with, because "successor to" and "preceded by" are the same edge read from two ends.
 */
function relationPhrase(relationType: string, direction: 'outgoing' | 'incoming'): string {
  const relation = humanizeToken(relationType).toLowerCase();
  return direction === 'incoming' ? `${relation}, from their record` : relation;
}

function toConnections(entity: PublicEntityView): readonly RoomConnection[] {
  return (entity.relatedNeighbors ?? []).map((neighbor) => ({
    name: neighbor.displayName,
    relation: neighbor.viaEvent
      ? `both appear in ${neighbor.viaEvent.displayName}`
      : relationPhrase(neighbor.relationType, neighbor.direction),
    href: `/entity/${neighbor.id}`,
  }));
}

export function EntityRoomSections({
  entity,
  framing,
  evidenceClaims,
  entityLinkCatalog,
  crossReferences = [],
}: EntityRoomSectionsProps) {
  const hasContext = entity.historicalContext.trim().length > 0;
  const hasStatus =
    entity.kind === 'event'
      ? entity.eventWindow !== undefined
      : Boolean(entity.status) || (entity.statusHistory?.length ?? 0) > 0;
  const connections = toConnections(entity);
  const continueLearning = entity.continueLearning ?? [];

  return (
    <>
      {hasContext ? (
        <section className="ds-record-beat" aria-labelledby="context-heading">
          <h2 className="ds-record-beat__heading" id="context-heading">
            The history here
          </h2>
          <div className="ds-room-prose">
            <LinkedProse
              text={entity.historicalContext}
              skipEntityIds={[entity.id]}
              catalog={entityLinkCatalog}
            />
          </div>
        </section>
      ) : null}

      {entity.extendedNarrative ? (
        <section className="ds-record-beat" aria-labelledby="further-heading">
          <h2 className="ds-record-beat__heading" id="further-heading">
            Further reading
          </h2>
          <div className="ds-room-prose">
            <p>{entity.extendedNarrative}</p>
          </div>
        </section>
      ) : null}

      {evidenceClaims.length > 0 ? (
        <section className="ds-record-beat" id="accepted-claims" aria-labelledby="claims-heading">
          <h2 className="ds-record-beat__heading" id="claims-heading">
            What the sources say
          </h2>
          <p className="ds-record-beat__standfirst">
            Each statement below is one accepted claim, shown with the source it was taken from
            and how strongly that source carries it.
          </p>
          <EntityEvidencePanel
            labelledBy="claims-heading"
            claims={evidenceClaims}
            researchCoverage={{ level: entity.researchCoverage }}
          />
        </section>
      ) : null}

      {hasStatus ? (
        <section className="ds-record-beat" aria-labelledby="status-heading">
          <h2 className="ds-record-beat__heading" id="status-heading">
            {entity.kind === 'event' ? 'When this happened' : 'Status and history'}
          </h2>
          <EntityStatusPanel entity={entity} framing={framing} />
        </section>
      ) : null}

      {entity.timeline.length > 0 ? (
        <section className="ds-record-beat" aria-labelledby="timeline-heading">
          <h2 className="ds-record-beat__heading" id="timeline-heading">
            Timeline
          </h2>
          <Timeline labelledBy="timeline-heading" items={entity.timeline} />
        </section>
      ) : null}

      {connections.length > 0 ? (
        <section className="ds-record-beat" aria-labelledby="related-heading">
          <h2 className="ds-record-beat__heading" id="related-heading">
            Records this one touches
          </h2>
          <Connections connections={connections} />
          {continueLearning.length > 0 ? (
            <>
              <h3 className="ds-record-beat__subheading" id="continue-heading">
                One step further
              </h3>
              <Connections
                connections={continueLearning.map((neighbor) => ({
                  name: neighbor.displayName,
                  relation: neighbor.viaEvent
                    ? `both appear in ${neighbor.viaEvent.displayName}`
                    : relationPhrase(neighbor.relationType, neighbor.direction),
                  href: `/entity/${neighbor.id}`,
                }))}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {crossReferences.length > 0 ? (
        <section className="ds-record-beat" aria-labelledby="appears-in-heading">
          <h2 className="ds-record-beat__heading" id="appears-in-heading">
            Where this record is written about
          </h2>
          <ul className="ds-record-beat__links" aria-label="Appears in">
            {crossReferences.map((surface) => (
              <li key={`${surface.kind}-${entityCrossReferenceHref(surface)}`}>
                <Link href={entityCrossReferenceHref(surface)} prefetch={false}>
                  {entityCrossReferenceLabel(surface)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
