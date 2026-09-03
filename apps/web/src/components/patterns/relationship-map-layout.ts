/**
 * Deterministic layout for the record room's relationship map.
 *
 * Pure geometry, kept out of the component so it can be tested without a renderer and so the
 * server and the client cannot compute two different pictures. Nothing here reads the DOM, the
 * viewport, or a clock: given the same graph it returns the same pixels every time, which is the
 * whole reason the map is not a force simulation. A physics layout settles somewhere new on every
 * load, cannot be server-rendered, and gives a keyboard reader no stable order to move through.
 *
 * The picture: time runs left to right, hops run top to bottom.
 *
 *   1890s ──────────────────────────────────────────▶ 1970s
 *   record   ◉ Dunbar High School
 *   1 hop      ● church        ● district      ● listing
 *   2 hops              ● school                    ● survey
 *   3 hops                          ○ alumni federation
 *   undated    ○ memorial   ○ ordinance
 *
 * A node's column is when it happened; its row is how far from the record it sits. Undated
 * records get their own labelled row rather than being invented onto the axis — a guessed date on
 * a history archive is worse than an admitted gap.
 */

export type RelationshipMapNodeInput = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly hop: number;
  readonly relationType: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly viaId?: string;
  // `| undefined` matches how the domain graph spells this optional under
  // `exactOptionalPropertyTypes`, so a `RelationshipGraph` is accepted here without a cast.
  readonly viaEvent?: { readonly id: string; readonly displayName: string } | undefined;
  readonly year?: number;
};

export type RelationshipMapLinkInput = {
  readonly source: string;
  readonly target: string;
  readonly relationType: string;
  readonly spine: boolean;
};

export type RelationshipMapGraphInput = {
  readonly centerId: string;
  readonly centerYear?: number;
  readonly nodes: readonly RelationshipMapNodeInput[];
  readonly links: readonly RelationshipMapLinkInput[];
};

/** Lane index a node sits in. `0` is the record itself; `undated` is always the last lane. */
export type RelationshipMapLane = {
  readonly key: string;
  readonly label: string;
  readonly y: number;
  readonly undated: boolean;
};

export type RelationshipMapPlacedNode = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly hop: number;
  readonly relationType: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly viaId?: string;
  readonly viaEventName?: string;
  readonly year?: number;
  readonly center: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** Ids from this node back to the record, nearest first. Drives the lit path on hover/focus. */
  readonly pathToCenter: readonly string[];
};

export type RelationshipMapPlacedLink = {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly relationType: string;
  readonly spine: boolean;
  readonly d: string;
};

export type RelationshipMapTick = {
  readonly year: number;
  readonly x: number;
  readonly label: string;
};

export type RelationshipMapLayout = {
  readonly width: number;
  readonly height: number;
  readonly lanes: readonly RelationshipMapLane[];
  readonly nodes: readonly RelationshipMapPlacedNode[];
  readonly links: readonly RelationshipMapPlacedLink[];
  readonly ticks: readonly RelationshipMapTick[];
  /** False when fewer than two distinct years exist, so no time axis is claimed. */
  readonly timeAxis: boolean;
  readonly maxHop: number;
};

/** Node box height. 44px is the minimum comfortable touch target, and every node is a link. */
export const NODE_HEIGHT = 44;
/** Lane pitch. Node height plus room for the connecting curves to read as curves. */
export const LANE_HEIGHT = 96;
/** Lane names are rendered in a fixed column beside the scroller, so the canvas owes them no room. */
const PAD_X = 16;
const PAD_TOP = 34;
const PAD_BOTTOM = 16;
const NODE_GAP = 12;
const MIN_NODE_WIDTH = 108;
const MAX_NODE_WIDTH = 216;
/** Approximate advance width per character at the node's font size. Layout only, never text. */
const CHAR_WIDTH = 7.1;
const NODE_PADDING_X = 26;
/** Virtual canvas width. Narrow viewports scroll this horizontally rather than reflowing it. */
const BASE_WIDTH = 860;

function nodeWidth(label: string): number {
  const ideal = Math.round(label.length * CHAR_WIDTH) + NODE_PADDING_X;
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, ideal));
}

function laneLabel(hop: number): string {
  if (hop === 0) return 'this record';
  return hop === 1 ? '1 hop' : `${hop} hops`;
}

/**
 * Axis ticks at round decades inside the range, capped so a two-century span does not print
 * twenty labels. Always includes the first and last decade covered.
 */
function buildTicks(
  minYear: number,
  maxYear: number,
  toX: (year: number) => number,
): readonly RelationshipMapTick[] {
  const first = Math.floor(minYear / 10) * 10;
  const last = Math.ceil(maxYear / 10) * 10;
  const decades = Math.max(1, (last - first) / 10);
  const step = 10 * Math.max(1, Math.ceil(decades / 6));
  const ticks: RelationshipMapTick[] = [];
  for (let year = first; year <= last; year += step) {
    ticks.push({ year, x: toX(year), label: `${year}s` });
  }
  return ticks;
}

/**
 * Place every node, resolve each one's path back to the record, and shape the connecting curves.
 *
 * `maxHop` trims the graph to the depth the reader asked for before anything is measured, so the
 * canvas shrinks when they dial the map back instead of leaving a hole where hop 3 used to be.
 */
export function layOutRelationshipMap(
  graph: RelationshipMapGraphInput,
  centerLabel: string,
  options: { readonly maxHop?: number } = {},
): RelationshipMapLayout {
  const maxHop = options.maxHop ?? 3;
  const visible = graph.nodes.filter((node) => node.hop <= maxHop);
  const visibleIds = new Set<string>([graph.centerId, ...visible.map((node) => node.id)]);

  const years: number[] = [];
  if (graph.centerYear !== undefined) years.push(graph.centerYear);
  for (const node of visible) if (node.year !== undefined) years.push(node.year);
  const distinct = new Set(years);
  const timeAxis = distinct.size >= 2;
  const minYear = years.length > 0 ? Math.min(...years) : 0;
  const maxYear = years.length > 0 ? Math.max(...years) : 0;

  const trackLeft = PAD_X;
  const trackWidth = BASE_WIDTH - trackLeft - PAD_X;
  const toX = (year: number): number =>
    timeAxis
      ? trackLeft + ((year - minYear) / (maxYear - minYear)) * trackWidth
      : trackLeft + trackWidth / 2;

  // Lanes: the record, then one per hop present, then undated if anything lands there.
  const hopsPresent = Array.from(new Set(visible.map((node) => node.hop))).sort((a, b) => a - b);
  const hasUndated =
    visible.some((node) => node.year === undefined) || (graph.centerYear === undefined && timeAxis);
  const laneKeys = ['0', ...hopsPresent.map(String), ...(hasUndated ? ['undated'] : [])];
  const lanes: RelationshipMapLane[] = laneKeys.map((key, index) => ({
    key,
    label: key === 'undated' ? 'undated' : laneLabel(Number(key)),
    y: PAD_TOP + index * LANE_HEIGHT,
    undated: key === 'undated',
  }));
  const laneY = new Map(lanes.map((lane) => [lane.key, lane.y]));

  type Draft = RelationshipMapPlacedNode & { readonly laneKey: string };
  const drafts: Draft[] = [];

  const centerDated = graph.centerYear !== undefined || !timeAxis;
  drafts.push({
    id: graph.centerId,
    displayName: centerLabel,
    kind: 'center',
    hop: 0,
    relationType: '',
    direction: 'outgoing',
    ...(graph.centerYear !== undefined ? { year: graph.centerYear } : {}),
    center: true,
    // The record keeps its own lane even when undated, so the map always opens on it.
    laneKey: '0',
    x: centerDated && graph.centerYear !== undefined ? toX(graph.centerYear) : trackLeft,
    y: laneY.get('0') ?? PAD_TOP,
    width: nodeWidth(centerLabel),
    pathToCenter: [],
  });

  const parentOf = new Map<string, string>();
  for (const node of visible) parentOf.set(node.id, node.viaId ?? graph.centerId);

  /** Walk `viaId` back to the record. Bounded by hop depth; a cycle cannot outrun the guard. */
  const pathFor = (id: string): readonly string[] => {
    const path: string[] = [];
    let cursor = parentOf.get(id);
    let guard = 0;
    while (cursor !== undefined && cursor !== graph.centerId && guard < 8) {
      path.push(cursor);
      cursor = parentOf.get(cursor);
      guard += 1;
    }
    path.push(graph.centerId);
    return path;
  };

  for (const node of visible) {
    const undated = node.year === undefined;
    const laneKey = undated && hasUndated ? 'undated' : String(node.hop);
    drafts.push({
      id: node.id,
      displayName: node.displayName,
      kind: node.kind,
      hop: node.hop,
      relationType: node.relationType,
      direction: node.direction,
      ...(node.viaId !== undefined && visibleIds.has(node.viaId) ? { viaId: node.viaId } : {}),
      ...(node.viaEvent !== undefined ? { viaEventName: node.viaEvent.displayName } : {}),
      ...(node.year !== undefined ? { year: node.year } : {}),
      center: false,
      laneKey,
      x: node.year !== undefined ? toX(node.year) : trackLeft,
      y: laneY.get(laneKey) ?? PAD_TOP,
      width: nodeWidth(node.displayName),
      pathToCenter: pathFor(node.id),
    });
  }

  // De-overlap within each lane: nodes keep their time order and are pushed right only as far as
  // it takes to stop touching. The axis stays honest to the left of every node it can.
  const placed: RelationshipMapPlacedNode[] = [];
  for (const lane of lanes) {
    const inLane = drafts
      .filter((draft) => draft.laneKey === lane.key)
      .sort((a, b) => a.x - b.x || a.displayName.localeCompare(b.displayName));
    let cursor = trackLeft;
    for (const draft of inLane) {
      const x = Math.max(draft.x, cursor);
      placed.push({ ...draft, x });
      cursor = x + draft.width + NODE_GAP;
    }
  }

  const byId = new Map(placed.map((node) => [node.id, node]));
  const width = Math.max(
    BASE_WIDTH,
    Math.ceil(Math.max(...placed.map((node) => node.x + node.width), trackLeft)) + PAD_X,
  );
  const height = PAD_TOP + lanes.length * LANE_HEIGHT + PAD_BOTTOM;

  const links: RelationshipMapPlacedLink[] = [];
  const seen = new Set<string>();
  for (const link of graph.links) {
    if (!visibleIds.has(link.source) || !visibleIds.has(link.target)) continue;
    const from = byId.get(link.source);
    const to = byId.get(link.target);
    if (!from || !to || from.id === to.id) continue;
    const key =
      link.source < link.target
        ? `${link.source}|${link.target}|${link.relationType}`
        : `${link.target}|${link.source}|${link.relationType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const x1 = from.x + from.width / 2;
    const y1 = from.y + NODE_HEIGHT / 2;
    const x2 = to.x + to.width / 2;
    const y2 = to.y + NODE_HEIGHT / 2;
    // Vertical-tangent cubic between lanes; same-lane links bow downward so they stay visible
    // instead of hiding behind the row of nodes they run along.
    const d =
      y1 === y2
        ? `M ${x1} ${y1 + NODE_HEIGHT / 2} C ${x1} ${y1 + LANE_HEIGHT / 2}, ${x2} ${y2 + LANE_HEIGHT / 2}, ${x2} ${y2 + NODE_HEIGHT / 2}`
        : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
    links.push({
      key,
      source: link.source,
      target: link.target,
      relationType: link.relationType,
      spine: link.spine,
      d,
    });
  }

  return {
    width,
    height,
    lanes,
    // Emitted in reading order — record first, then outward by hop, then by time within a hop —
    // because these are real links and this is the order a keyboard or screen reader walks.
    nodes: placed.slice().sort((a, b) => a.hop - b.hop || a.x - b.x),
    links,
    ticks: timeAxis ? buildTicks(minYear, maxYear, toX) : [],
    timeAxis,
    maxHop: visible.reduce((max, node) => Math.max(max, node.hop), 0),
  };
}
