/**
 * Builds display-ready history graph nodes and edges from release artifacts.
 * Consumes pre-derived `DecadeGraphView` / `AllTimeGraphView` docs — no request-time traversal.
 */
import type { EntityRelationship, GraphReleaseArtifact } from '@repo/domain';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { resolveAllTimeStatusLabel, resolveDecadeStatusLabel } from './decade-status';
import { applyHistoryKindFilter, buildHistoryKindFacetOptions, type HistoryFilterState } from './filters';
import type { HistoryViewMode } from './url-state';

export type HistoryNodeView = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  readonly statusLabel: string;
  readonly statusKind: 'status' | 'event-window' | 'undated';
  readonly evidenceCount: number;
  /** Evidence-backed edges touching this node in the current graph slice. */
  readonly connectionCount: number;
  readonly href: string;
  readonly topicTags: readonly string[];
};

export type HistoryEdgeCitation = {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
};

export type HistoryEdgeView = {
  readonly edgeId: string;
  readonly relationshipId: string;
  readonly type: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly fromDisplayName: string;
  readonly toDisplayName: string;
  readonly evidenceCount: number;
  readonly citations: readonly HistoryEdgeCitation[];
  readonly timespan?: { readonly validFrom?: string; readonly validTo?: string | null };
  readonly sentence: string;
};

export type HistoryGraphSlice = {
  readonly mode: HistoryViewMode;
  readonly activeDecade?: string;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly sparseDecade: boolean;
};

function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function entityHref(entityId: string): string {
  return `/entity/${entityId}`;
}

function relationshipSentence(
  rel: EntityRelationship,
  fromName: string,
  toName: string,
): string {
  const templates: Readonly<Record<string, (from: string, to: string) => string>> = {
    located_at: (from, to) => `${from} is located at ${to}.`,
    occurred_at: (from, to) => `${from} occurred at ${to}.`,
    commemorates: (from, to) => `${from} commemorates ${to}.`,
    part_of: (from, to) => `${from} is part of ${to}.`,
    founded: (from, to) => `${from} founded ${to}.`,
  };
  const template =
    templates[rel.type] ??
    ((from: string, to: string) => `${from} ${humanizeToken(rel.type).toLowerCase()} ${to}.`);
  return template(fromName, toName);
}

function resolveEdgeCitations(
  rel: EntityRelationship,
  entitiesById: ReadonlyMap<string, PublicEntityView>,
): readonly HistoryEdgeCitation[] {
  return rel.evidenceIds.map((evidenceId) => {
    for (const entity of entitiesById.values()) {
      const claim = entity.claims.find((entry) => entry.id === evidenceId);
      if (claim) {
        return {
          id: evidenceId,
          label: claim.citationLabel,
          ...(claim.citationHref ? { href: claim.citationHref } : {}),
        };
      }
    }
    return { id: evidenceId, label: `Evidence record ${evidenceId}` };
  });
}

function buildNodeView(
  entity: PublicEntityView,
  mode: HistoryViewMode,
  decade: string | undefined,
): HistoryNodeView {
  const status =
    mode === 'decade' && decade
      ? resolveDecadeStatusLabel(entity, decade)
      : resolveAllTimeStatusLabel(entity);

  return {
    entityId: entity.id,
    displayName: entity.displayName,
    kind: entity.kind,
    summary: entity.summary,
    statusLabel: status.label,
    statusKind: status.kind,
    evidenceCount: entity.claims.length,
    connectionCount: 0,
    href: entityHref(entity.id),
    topicTags: entity.topicTags,
  };
}

export function resolveHistoryGraphSlice(
  artifact: GraphReleaseArtifact,
  mode: HistoryViewMode,
  decade: string | undefined,
): HistoryGraphSlice {
  if (mode === 'all-time') {
    return {
      mode,
      nodeIds: artifact.allTimeView.nodeIds,
      edgeIds: artifact.allTimeView.edgeIds,
      sparseDecade: false,
    };
  }

  const view = artifact.decadeViews.find((entry) => entry.decade === decade);
  const sparseDecade = !view || view.nodeIds.length === 0;

  return {
    mode: 'decade',
    ...(decade ? { activeDecade: decade } : {}),
    nodeIds: view?.nodeIds ?? [],
    edgeIds: view?.edgeIds ?? [],
    sparseDecade,
  };
}

export function decadeLabelsFromArtifact(artifact: GraphReleaseArtifact): readonly string[] {
  if (artifact.decadeViews.length === 0) return [];
  const decades = artifact.decadeViews.map((view) => view.decade);
  const startYear = Number.parseInt(decades[0]!.slice(0, 4), 10);
  const endYear = Number.parseInt(decades[decades.length - 1]!.slice(0, 4), 10);
  const labels: string[] = [];
  for (let year = startYear; year <= endYear; year += 10) {
    labels.push(`${year}s`);
  }
  return labels;
}

export function buildHistoryNodes(
  slice: HistoryGraphSlice,
  filters: HistoryFilterState,
  entitiesById: ReadonlyMap<string, PublicEntityView>,
): readonly HistoryNodeView[] {
  const nodes = slice.nodeIds
    .map((id) => entitiesById.get(id))
    .filter((entity): entity is PublicEntityView => entity !== undefined)
    .map((entity) => buildNodeView(entity, slice.mode, slice.activeDecade));

  // Kind only here; query + sort apply after connection counts are attached in the view-model.
  return [...applyHistoryKindFilter(nodes, filters)];
}

/** Attach per-node connection counts from the visible edge set. */
export function withHistoryConnectionCounts(
  nodes: readonly HistoryNodeView[],
  edges: readonly HistoryEdgeView[],
): readonly HistoryNodeView[] {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.fromEntityId, (counts.get(edge.fromEntityId) ?? 0) + 1);
    counts.set(edge.toEntityId, (counts.get(edge.toEntityId) ?? 0) + 1);
  }
  return nodes.map((node) => ({
    ...node,
    connectionCount: counts.get(node.entityId) ?? 0,
  }));
}

export function buildHistoryEdges(
  slice: HistoryGraphSlice,
  relationships: readonly EntityRelationship[],
  entitiesById: ReadonlyMap<string, PublicEntityView>,
  visibleNodeIds: ReadonlySet<string>,
): readonly HistoryEdgeView[] {
  const relById = new Map(relationships.map((rel) => [rel.id, rel]));
  const edges: HistoryEdgeView[] = [];

  for (const edgeId of slice.edgeIds) {
    const rel = relById.get(edgeId);
    if (!rel || rel.evidenceIds.length === 0) continue;
    if (!visibleNodeIds.has(rel.fromEntityId) || !visibleNodeIds.has(rel.toEntityId)) continue;

    const fromEntity = entitiesById.get(rel.fromEntityId);
    const toEntity = entitiesById.get(rel.toEntityId);
    if (!fromEntity || !toEntity) continue;

    edges.push({
      edgeId: rel.id,
      relationshipId: rel.id,
      type: rel.type,
      fromEntityId: rel.fromEntityId,
      toEntityId: rel.toEntityId,
      fromDisplayName: fromEntity.displayName,
      toDisplayName: toEntity.displayName,
      evidenceCount: rel.evidenceIds.length,
      citations: resolveEdgeCitations(rel, entitiesById),
      ...(rel.temporal
        ? {
            timespan: {
              ...(rel.temporal.validFrom !== undefined ? { validFrom: rel.temporal.validFrom } : {}),
              ...(rel.temporal.validTo !== undefined ? { validTo: rel.temporal.validTo } : {}),
            },
          }
        : {}),
      sentence: relationshipSentence(rel, fromEntity.displayName, toEntity.displayName),
    });
  }

  return edges.sort((a, b) => a.sentence.localeCompare(b.sentence));
}

export function buildHistoryGraphContext(
  artifact: GraphReleaseArtifact,
  entities: readonly PublicEntityView[] = listPublicEntities(),
) {
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const kinds = entities.map((entity) => entity.kind);

  return {
    entities,
    entitiesById,
    facetOptions: {
      kind: buildHistoryKindFacetOptions(kinds),
    },
    availableDecades: decadeLabelsFromArtifact(artifact),
    releaseId: artifact.releaseId,
    contentHash: artifact.contentHash.digest,
  };
}
