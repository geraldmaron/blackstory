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
import { neighborHref } from '../../../lib/place/public-place-path';
import { firstPaintRelatedHeading, firstPaintRelation } from '../../home-first-paint-surface';

void React;

/**
 * The column's sections, in render order, with the ids the rail's table of contents links to.
 *
 * Derived once and consumed twice (here for the conditionals, in `page.tsx` for the TOC), so
 * a record that has no timeline cannot end up with a "Timeline" link in its rail. Two copies
 * of these predicates in two files is exactly how that drift happens.
 */
export type RecordSection = {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
};

export function recordSectionIndex({
  entity,
  evidenceClaims,
  crossReferences = [],
}: {
  readonly entity: PublicEntityView;
  readonly evidenceClaims: readonly EvidenceClaimInput[];
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
}): readonly RecordSection[] {
  const sections: RecordSection[] = [];
  if (entity.historicalContext.trim().length > 0) {
    sections.push({ id: 'context-heading', label: 'The history here' });
  }
  if (entity.extendedNarrative) {
    sections.push({ id: 'further-heading', label: 'Further reading' });
  }
  if (evidenceClaims.length > 0) {
    sections.push({
      id: 'claims-heading',
      label: 'What the sources say',
      count: evidenceClaims.length,
    });
  }
  if (hasStatusFor(entity)) {
    sections.push({
      id: 'status-heading',
      label: entity.kind === 'event' ? 'When this happened' : 'Status and history',
    });
  }
  if (entity.timeline.length > 0) {
    sections.push({ id: 'timeline-heading', label: 'Timeline', count: entity.timeline.length });
  }
  const connectionCount = toConnections(entity, false).length;
  if (connectionCount > 0) {
    sections.push({
      id: 'related-heading',
      label: 'Records this one touches',
      count: connectionCount,
    });
  }
  if (crossReferences.length > 0) {
    sections.push({
      id: 'appears-in-heading',
      label: 'Where this record is written about',
      count: crossReferences.length,
    });
  }
  return sections;
}

export type EntityRoomSectionsProps = {
  readonly entity: PublicEntityView;
  readonly evidenceClaims: readonly EvidenceClaimInput[];
  readonly entityLinkCatalog: readonly EntityLinkCatalogEntry[];
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
  /** First paint: human place lines, no status chrome, no catalog related heading. */
  readonly firstPaint?: boolean;
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

/** Shared by the section index and the component, so the rail and the column cannot disagree. */
function hasStatusFor(entity: PublicEntityView): boolean {
  return entity.kind === 'event'
    ? entity.eventWindow !== undefined
    : Boolean(entity.status) || (entity.statusHistory?.length ?? 0) > 0;
}

function toConnections(entity: PublicEntityView, firstPaint: boolean): readonly RoomConnection[] {
  return (entity.relatedNeighbors ?? []).flatMap((neighbor) => {
    const relation = firstPaint
      ? firstPaintRelation(neighbor, entity)
      : neighbor.viaEvent
        ? `both appear in ${neighbor.viaEvent.displayName}`
        : relationPhrase(neighbor.relationType, neighbor.direction);
    const href = firstPaint ? neighborHref(neighbor) : `/entity/${neighbor.id}`;
    if (firstPaint && (relation === undefined || relation.length === 0)) {
      return [{ name: neighbor.displayName, relation: '', href }];
    }
    return [
      {
        name: neighbor.displayName,
        relation: relation ?? '',
        href,
      },
    ];
  });
}

export function EntityRoomSections({
  entity,
  evidenceClaims,
  entityLinkCatalog,
  crossReferences = [],
  firstPaint = false,
}: EntityRoomSectionsProps) {
  const hasContext = entity.historicalContext.trim().length > 0;
  const hasStatus = firstPaint ? false : hasStatusFor(entity);
  const connections = firstPaint
    ? [
        ...toConnections(entity, true),
        ...(entity.continueLearning ?? []).map((neighbor) => ({
          name: neighbor.displayName,
          relation: firstPaintRelation(neighbor, entity) ?? '',
          href: neighborHref(neighbor),
        })),
      ].filter(
        (connection, index, list) =>
          list.findIndex((other) => other.href === connection.href) === index,
      )
    : toConnections(entity, false);
  const continueLearning = firstPaint ? [] : (entity.continueLearning ?? []);
  const relatedHeading = firstPaint
    ? firstPaintRelatedHeading([
        ...(entity.relatedNeighbors ?? []),
        ...(entity.continueLearning ?? []),
      ])
    : 'Records this one touches';

  return (
    <>
      {hasContext ? (
        <section className="ds-record-beat" aria-labelledby="context-heading">
          <h2 className="ds-record-beat__heading" id="context-heading">
            The history here
          </h2>
          <div className="ds-room-prose">
            {entity.historicalContext
              .split(/\n\s*\n/)
              .filter((paragraph) => paragraph.trim().length > 0)
              .map((paragraph, index) => (
                <LinkedProse
                  key={`context-${index}`}
                  text={paragraph}
                  skipEntityIds={[entity.id]}
                  catalog={entityLinkCatalog}
                  {...(firstPaint
                    ? {
                        hrefFor: (entry: { readonly label: string }) =>
                          neighborHref({ displayName: entry.label, kind: 'place' }),
                      }
                    : {})}
                />
              ))}
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
            Each statement below is one accepted claim, shown with the source it was taken from and
            how strongly that source carries it.
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
          <EntityStatusPanel entity={entity} />
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

      {connections.length > 0 && relatedHeading ? (
        <section className="ds-record-beat" aria-labelledby="related-heading">
          <h2 className="ds-record-beat__heading" id="related-heading">
            {relatedHeading}
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
                  relation: firstPaint
                    ? (firstPaintRelation(neighbor, entity) ?? '')
                    : neighbor.viaEvent
                      ? `both appear in ${neighbor.viaEvent.displayName}`
                      : relationPhrase(neighbor.relationType, neighbor.direction),
                  href: firstPaint ? neighborHref(neighbor) : `/entity/${neighbor.id}`,
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
