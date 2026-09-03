/**
 * The record room's column: what is known about this record, in reading order.
 *
 * This replaces the v6 edition stack, which rendered every beat as a numbered panel (00 RECORD,
 * 01 ANATOMY, 02 CONTEXT, 03 RELEVANCE, 04 STATUS, 05 CLAIMS, 06 PROVENANCE) inside its own
 * bordered card. Six chapter numbers is a promise of six chapters, and most records have one
 * sourced paragraph and a location, so the page read as a filing cabinet: identical gray boxes,
 * each announcing itself, several of them apologising for being empty.
 *
 * What is here instead: the orientation facts move to the masthead and the fact strip (see
 * page.tsx), and the column carries only what a person would actually read, under beats that
 * share one heading (`RecordBeatHead`: a running index, a section icon, the title, a count when
 * the section is a list). A beat still renders only when the record has that content, and the
 * index counts the beats that render, so a record with two beats reads 01 and 02, never 03 and
 * 06. The gaps are disclosed once, in the apparatus band, using the approved `RECORD_GAP_COPY`
 * vocabulary.
 *
 * The summary is not repeated. It is the lede, in the header, and nowhere else: the v6 page
 * printed the same sentence as the lede, again as "Inclusion evidence", and a third time as the
 * accepted claim. The claim keeps it, because that is the copy that carries a citation.
 */
import React from 'react';
import Link from 'next/link';
import { Timeline } from '@repo/ui';
import type { PublicEntityView, RelationshipGraph } from '../../../data/public-seed';
import type { EvidenceClaimInput } from '../../../lib/evidence';
import {
  entityCrossReferenceHref,
  entityCrossReferenceLabel,
  type EntityCrossReferenceSurface,
} from '../../../lib/theme-impact/source';
import { EntityEvidencePanel } from '../../../components/evidence';
import { EntityStatusPanel } from '../../../components/entity/EntityStatusPanel';
import { LinkedProse, type EntityLinkCatalogEntry } from '../../../components/entity/LinkedProse';
import { RecordBeatHead } from '../../../components/entity/RecordChrome';
import { Connections, type RoomConnection } from '../../../components/room';
import { RelationshipTree } from '../../../components/patterns/RelationshipTree';
import { RecordArchiveSources } from '../../../components/patterns/RecordArchiveSources';
import { humanizeToken } from '../../../components/entity/format';
import { resolveInternetArchiveSources } from '../../../lib/geography/internet-archive-sources';
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
  const archiveSources = resolveInternetArchiveSources(entity.claims);
  if (archiveSources.length > 0) {
    sections.push({
      id: 'record-archive-heading',
      label: 'Archived copies',
      count: archiveSources.length,
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
  // One beat when the record has a graph, two when it falls back to the flat lists. The tree
  // already contains everything "Worth investigating next" used to list separately (those were
  // the records one step further out), so shipping both would restore the duplication it removes.
  const graph = treeGraphFor(entity);
  if (graph) {
    sections.push({
      id: 'related-heading',
      label: 'How this record connects',
      count: graph.nodes.length,
    });
  } else {
    const connectionCount = toConnections(entity, false).length;
    if (connectionCount > 0) {
      sections.push({
        id: 'related-heading',
        label: 'Records this one touches',
        count: connectionCount,
      });
    }
    const continueCount = toSuggestedConnections(entity, false).length;
    if (continueCount > 0) {
      sections.push({
        id: 'continue-heading',
        label: 'Worth investigating next',
        count: continueCount,
      });
    }
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

/**
 * How many beats `EntityRoomSections` will render for this record, so a surface that adds beats
 * of its own after it (the place page's Stories and Trust) can continue the running index
 * instead of restarting at 01. Mirrors the render conditions below, in the same order.
 */
export function renderedBeatCount({
  entity,
  evidenceClaims,
  crossReferences = [],
  firstPaint = false,
}: {
  readonly entity: PublicEntityView;
  readonly evidenceClaims: readonly EvidenceClaimInput[];
  readonly crossReferences?: readonly EntityCrossReferenceSurface[];
  readonly firstPaint?: boolean;
}): number {
  let count = 0;
  if (entity.historicalContext.trim().length > 0) count += 1;
  if (entity.extendedNarrative) count += 1;
  if (evidenceClaims.length > 0) count += 1;
  if (!firstPaint && hasStatusFor(entity)) count += 1;
  if (entity.timeline.length > 0) count += 1;
  if (treeGraphFor(entity)) {
    count += 1;
  } else {
    const relatedHeading = firstPaint
      ? firstPaintRelatedHeading(entity.relatedNeighbors ?? [])
      : 'Records this one touches';
    if (toConnections(entity, firstPaint).length > 0 && relatedHeading) count += 1;
    if (toSuggestedConnections(entity, firstPaint).length > 0) count += 1;
  }
  if (crossReferences.length > 0) count += 1;
  return count;
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

/**
 * Connection relations in the door's human vocabulary, keyed by record id.
 *
 * `firstPaintRelation` returns undefined when the stored token would not survive being read
 * aloud; those records are simply left out, and the tree then shows the record's name with no
 * phrase above it. Built here rather than passed as a callback so the shape stays serialisable
 * across the server boundary.
 */
function firstPaintNodeLabels(entity: PublicEntityView): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const node of entity.relationshipGraph?.nodes ?? []) {
    const phrase = firstPaintRelation(
      {
        id: node.id,
        displayName: node.displayName,
        kind: node.kind,
        summary: node.summary,
        relationType: node.relationType,
        direction: node.direction,
        ...(node.viaEvent !== undefined ? { viaEvent: node.viaEvent } : {}),
      },
      entity,
    );
    if (phrase !== undefined && phrase.length > 0) labels[node.id] = phrase;
  }
  return labels;
}

/**
 * The relationship graph, when it is worth drawing.
 *
 * A one-node graph is a sentence, not a web. It would spend a framed panel on a single link, and
 * those records keep the flat lists, which say the same thing in a line. Shared by the section
 * index, the beat count and the column, so the rail cannot promise a beat the column does not
 * render.
 *
 * The door and place surfaces get the tree too. They are the same record column under a different
 * vocabulary, and they carried the same two overlapping lists, so exempting them would have left
 * the duplication standing on the surface it was actually reported from. What changes there is
 * the wording, through `firstPaintNodeLabel`, not the picture.
 */
function treeGraphFor(entity: PublicEntityView): RelationshipGraph | undefined {
  const graph = entity.relationshipGraph;
  if (!graph || graph.nodes.length < 2) return undefined;
  return graph;
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
    const href = neighborHref(neighbor);
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

function toSuggestedConnections(
  entity: PublicEntityView,
  firstPaint: boolean,
): readonly RoomConnection[] {
  return (entity.continueLearning ?? []).map((neighbor) => ({
    name: neighbor.displayName,
    relation: firstPaint
      ? (firstPaintRelation(neighbor, entity) ?? '')
      : neighbor.viaEvent
        ? `both appear in ${neighbor.viaEvent.displayName}`
        : relationPhrase(neighbor.relationType, neighbor.direction),
    href: neighborHref(neighbor),
  }));
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
  const treeGraph = treeGraphFor(entity);
  const connections = toConnections(entity, firstPaint);
  const continueLearning = toSuggestedConnections(entity, firstPaint);
  const archiveSources = resolveInternetArchiveSources(entity.claims);
  const relatedHeading = firstPaint
    ? firstPaintRelatedHeading(entity.relatedNeighbors ?? [])
    : 'Records this one touches';

  // Running index over the beats that actually render, in document order.
  let beat = 0;
  const nextIndex = (): string => String(++beat).padStart(2, '0');

  return (
    <>
      {hasContext ? (
        <section className="ds-record-beat" aria-labelledby="context-heading">
          <RecordBeatHead
            id="context-heading"
            index={nextIndex()}
            icon="context"
            title="The history here"
          />
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
          <RecordBeatHead
            id="further-heading"
            index={nextIndex()}
            icon="further"
            title="Further reading"
          />
          <div className="ds-room-prose">
            <p>{entity.extendedNarrative}</p>
          </div>
        </section>
      ) : null}

      {evidenceClaims.length > 0 ? (
        <section className="ds-record-beat" id="accepted-claims" aria-labelledby="claims-heading">
          <RecordBeatHead
            id="claims-heading"
            index={nextIndex()}
            icon="claims"
            title="What the sources say"
            count={evidenceClaims.length}
            standfirst="Each statement below is one accepted claim, shown with the source it was taken from and how strongly that source carries it."
          />
          <EntityEvidencePanel
            labelledBy="claims-heading"
            claims={evidenceClaims}
            researchCoverage={{ level: entity.researchCoverage }}
          />
        </section>
      ) : null}

      {archiveSources.length > 0 ? (
        <section className="ds-record-beat" aria-labelledby="record-archive-heading">
          <RecordArchiveSources sources={archiveSources} />
        </section>
      ) : null}

      {hasStatus ? (
        <section className="ds-record-beat" aria-labelledby="status-heading">
          <RecordBeatHead
            id="status-heading"
            index={nextIndex()}
            icon="status"
            title={entity.kind === 'event' ? 'When this happened' : 'Status and history'}
          />
          <EntityStatusPanel entity={entity} />
        </section>
      ) : null}

      {entity.timeline.length > 0 ? (
        <section className="ds-record-beat" aria-labelledby="timeline-heading">
          <RecordBeatHead
            id="timeline-heading"
            index={nextIndex()}
            icon="timeline"
            title="Timeline"
            count={entity.timeline.length}
          />
          <Timeline labelledBy="timeline-heading" items={entity.timeline} />
        </section>
      ) : null}

      {treeGraph ? (
        <section className="ds-record-beat" aria-labelledby="related-heading">
          <RecordBeatHead
            id="related-heading"
            index={nextIndex()}
            icon="related"
            title={firstPaint ? 'How this place connects' : 'How this record connects'}
            count={treeGraph.nodes.length}
          />
          <RelationshipTree
            centerLabel={entity.displayName}
            graph={treeGraph}
            {...(firstPaint ? { labels: firstPaintNodeLabels(entity) } : {})}
          />
        </section>
      ) : (
        <>
          {connections.length > 0 && relatedHeading ? (
            <section className="ds-record-beat" aria-labelledby="related-heading">
              <RecordBeatHead
                id="related-heading"
                index={nextIndex()}
                icon="related"
                title={relatedHeading}
                count={connections.length}
                standfirst="Typed connections from the archive. Nearby on the map is not the same as related."
              />
              <Connections connections={connections} />
            </section>
          ) : null}

          {continueLearning.length > 0 ? (
            <section className="ds-record-beat" aria-labelledby="continue-heading">
              <RecordBeatHead
                id="continue-heading"
                index={nextIndex()}
                icon="continue"
                title="Worth investigating next"
                count={continueLearning.length}
                standfirst="Leads from this record. They are not proven the same way as a typed connection."
              />
              <Connections connections={continueLearning} />
            </section>
          ) : null}
        </>
      )}

      {crossReferences.length > 0 ? (
        <section className="ds-record-beat" aria-labelledby="appears-in-heading">
          <RecordBeatHead
            id="appears-in-heading"
            index={nextIndex()}
            icon="appears"
            title="Where this record is written about"
            count={crossReferences.length}
          />
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
