/**
 * The record sheet's sources and connections, derived on the client from data the Atlas already
 * holds.
 *
 * The sheet used to hardcode `sources: []` and `connections: []`, so it always fell through to
 * "no sources are published for this record yet" — on records whose own anatomy line, three rows
 * above, read "Grade A · 1 source". The fix is not a new fetch. The explore view model already
 * ships the history-graph edge catalog to the client for the line layer, and every edge carries
 * its relationship type and its citations. Both halves of the sheet's apparatus are already in
 * the browser; they were simply never read.
 *
 * The ALL-TIME slice is the right input, not the active decade slice. The decade rail filters
 * what the map draws; it must not filter what a record is documented by. A reader who has
 * scrubbed to 1920 is still owed the 1890 founding relationship when they open the record.
 */
import type { HistoryEdgeView } from '../history/build-history-graph';
import type { SheetConnection, SheetSource } from '../../components/map-experience/RecordSheet';

/** What the sheet needs to know about the entity on the other end of an edge. */
export type ConnectedRecordLookup = (entityId: string) => {
  readonly name?: string;
  readonly kind?: string;
  readonly mapTone?: string;
  readonly href?: string;
} | undefined;

/** Edges incident to a record, in either direction. */
export function edgesTouching(
  edges: readonly HistoryEdgeView[],
  entityId: string,
): readonly HistoryEdgeView[] {
  return edges.filter(
    (edge) => edge.fromEntityId === entityId || edge.toEntityId === entityId,
  );
}

/**
 * "founded_by" -> "founded by". Lowercase on purpose: the sheet sets this in mono as a relation
 * phrase inside a sentence-shaped row, not as a title.
 */
export function relationPhrase(type: string): string {
  return type.replace(/[_-]+/g, ' ').trim().toLowerCase();
}

/**
 * The record's documented connections.
 *
 * Deduplicated by the entity on the other end: two relationships between the same pair render as
 * one row rather than repeating a name, and the first (edges arrive sorted by sentence) wins.
 * A self-edge is dropped — a record does not connect to itself.
 */
export function buildSheetConnections(
  edges: readonly HistoryEdgeView[],
  entityId: string,
  lookup: ConnectedRecordLookup = () => undefined,
): readonly SheetConnection[] {
  const connections: SheetConnection[] = [];
  const seen = new Set<string>();

  for (const edge of edgesTouching(edges, entityId)) {
    const outbound = edge.fromEntityId === entityId;
    const otherId = outbound ? edge.toEntityId : edge.fromEntityId;
    if (otherId === entityId || seen.has(otherId)) continue;
    seen.add(otherId);

    const known = lookup(otherId);
    const name = known?.name ?? (outbound ? edge.toDisplayName : edge.fromDisplayName);
    if (name.trim() === '') continue;

    connections.push({
      id: otherId,
      name,
      kind: known?.kind ?? 'record',
      relation: relationPhrase(edge.type),
      ...(known?.mapTone ? { mapTone: known.mapTone } : {}),
      ...(known?.href ? { href: known.href } : {}),
    });
  }
  return connections;
}

/**
 * The record's numbered sources: every citation on every edge that touches it, deduplicated by
 * citation id so a source backing three relationships is listed once.
 */
export function buildSheetSources(
  edges: readonly HistoryEdgeView[],
  entityId: string,
): readonly SheetSource[] {
  const sources: SheetSource[] = [];
  const seen = new Set<string>();

  for (const edge of edgesTouching(edges, entityId)) {
    for (const citation of edge.citations) {
      if (seen.has(citation.id)) continue;
      seen.add(citation.id);
      sources.push({
        id: citation.id,
        title: citation.label,
        detail: `Cited for: ${edge.sentence}`,
        ...(citation.href ? { href: citation.href } : {}),
      });
    }
  }
  return sources;
}
