/**
 * Collision layout for place numerals, in screen pixels (`docs/ui/patterns-place-map.md`, "Token
 * anatomy"). Pure: `place-labels.ts` feeds it the positions MapLibre projected this frame.
 *
 * Every record stays counted, so a numeral is never dropped. Tokens place in descending count
 * order (ties by key): one whose box is free stays on its anchor; one that collides moves to the
 * nearest free candidate on a fixed ring of directions at growing radii, and carries a leader back
 * to its anchor. If nothing within `maxRadius` is free, the least-overlapping candidate wins and is
 * still drawn. Layout is recomputed from scratch each frame, so the same input gives the same
 * output and nothing drifts while panning.
 */

export type Box = {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};
export type Point = { readonly x: number; readonly y: number };

export type TokenInput = {
  readonly key: string;
  /** The anchor, projected to the viewport. */
  readonly x: number;
  readonly y: number;
  readonly count: number;
  /** Numeral box. */
  readonly width: number;
  readonly height: number;
  /** The name's box relative to the numeral's center, or undefined when MapLibre placed none. */
  readonly name?: { readonly dx: number; readonly width: number; readonly height: number };
};

export type TokenPlacement = {
  readonly key: string;
  /** Numeral center. */
  readonly x: number;
  readonly y: number;
  readonly displaced: boolean;
  /** False when the name had to yield to a neighbor. */
  readonly nameShown: boolean;
  /** Numeral edge to anchor; only on displaced tokens. */
  readonly leader?: { readonly from: Point; readonly to: Point };
};

export type LayoutOptions = {
  /** Clear space kept around every box. */
  readonly pad: number;
  /** Radius step between candidate rings. */
  readonly step: number;
  readonly maxRadius: number;
  readonly directions: number;
};

export const DEFAULT_LAYOUT: LayoutOptions = { pad: 2, step: 8, maxRadius: 96, directions: 12 };

const CELL = 48;

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

const grow = (box: Box, by: number): Box => ({
  x0: box.x0 - by,
  y0: box.y0 - by,
  x1: box.x1 + by,
  y1: box.y1 + by,
});

const centered = (x: number, y: number, w: number, h: number): Box => ({
  x0: x - w / 2,
  y0: y - h / 2,
  x1: x + w / 2,
  y1: y + h / 2,
});

class Grid {
  private readonly cells = new Map<string, Box[]>();

  private each(box: Box, visit: (cell: Box[]) => void, create: boolean): void {
    for (let cx = Math.floor(box.x0 / CELL); cx <= Math.floor(box.x1 / CELL); cx++) {
      for (let cy = Math.floor(box.y0 / CELL); cy <= Math.floor(box.y1 / CELL); cy++) {
        const id = `${cx},${cy}`;
        let cell = this.cells.get(id);
        if (!cell && create) this.cells.set(id, (cell = []));
        if (cell) visit(cell);
      }
    }
  }

  add(box: Box): void {
    this.each(box, (cell) => cell.push(box), true);
  }

  /** Total overlap with stored boxes; each box counts once. */
  overlap(box: Box): number {
    const seen = new Set<Box>();
    let total = 0;
    this.each(
      box,
      (cell) => {
        for (const other of cell) {
          if (seen.has(other)) continue;
          seen.add(other);
          total += overlapArea(box, other);
        }
      },
      false,
    );
    return total;
  }
}

/** The point on `box` nearest to `p` (p itself when inside). */
function nearestOnBox(box: Box, p: Point): Point {
  return {
    x: Math.min(Math.max(p.x, box.x0), box.x1),
    y: Math.min(Math.max(p.y, box.y0), box.y1),
  };
}

/** Candidate centers around an anchor: the anchor first, then rings of increasing radius. */
function* candidates(x: number, y: number, o: LayoutOptions): Generator<Point> {
  yield { x, y };
  for (let ring = 1; ring * o.step <= o.maxRadius; ring++) {
    const r = ring * o.step;
    // Alternate rings are offset half a step so the directions interleave.
    const phase = ring % 2 === 0 ? Math.PI / o.directions : 0;
    for (let d = 0; d < o.directions; d++) {
      const angle = phase + (d * 2 * Math.PI) / o.directions;
      yield { x: x + r * Math.cos(angle), y: y + r * Math.sin(angle) };
    }
  }
}

export function layoutTokens(
  tokens: readonly TokenInput[],
  obstacles: readonly Box[],
  options: LayoutOptions = DEFAULT_LAYOUT,
): TokenPlacement[] {
  const grid = new Grid();
  for (const obstacle of obstacles) grid.add(grow(obstacle, options.pad));
  const order = [...tokens].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
  const placed = new Map<string, TokenPlacement>();

  for (const token of order) {
    const numeral = (c: Point) => grow(centered(c.x, c.y, token.width, token.height), options.pad);
    const nameBox = (c: Point): Box | undefined =>
      token.name &&
      grow(
        centered(
          c.x + token.name.dx + token.name.width / 2,
          c.y,
          token.name.width,
          token.name.height,
        ),
        options.pad,
      );
    const anchor = { x: token.x, y: token.y };

    // At the anchor, the name yields before the numeral moves.
    const home = numeral(anchor);
    const homeName = nameBox(anchor);
    let result: TokenPlacement | undefined;
    if (grid.overlap(home) === 0) {
      const withName = homeName !== undefined && grid.overlap(homeName) === 0;
      result = { key: token.key, ...anchor, displaced: false, nameShown: withName };
      grid.add(home);
      if (withName && homeName) grid.add(homeName);
    }

    if (!result) {
      let best: { c: Point; area: number } | undefined;
      for (const c of candidates(token.x, token.y, options)) {
        // The anchor was tried above; a displaced box must also leave it outside, or the leader
        // would have no length.
        if (c.x === token.x && c.y === token.y) continue;
        const box = numeral(c);
        if (
          anchor.x > box.x0 + options.pad &&
          anchor.x < box.x1 - options.pad &&
          anchor.y > box.y0 + options.pad &&
          anchor.y < box.y1 - options.pad
        ) {
          continue;
        }
        const area = grid.overlap(box);
        if (!best || area < best.area) best = { c, area };
        if (area === 0) break;
      }
      // Every candidate contains the anchor only for a box wider than the whole radius: never in
      // practice, but the numeral still draws on its anchor rather than vanish.
      const c = best?.c ?? anchor;
      const box = numeral(c);
      grid.add(box);
      const edge = nearestOnBox(
        {
          x0: box.x0 + options.pad,
          y0: box.y0 + options.pad,
          x1: box.x1 - options.pad,
          y1: box.y1 - options.pad,
        },
        anchor,
      );
      result = {
        key: token.key,
        x: c.x,
        y: c.y,
        displaced: best !== undefined,
        nameShown: false,
        ...(best ? { leader: { from: edge, to: anchor } } : {}),
      };
    }
    placed.set(token.key, result);
  }
  return tokens.map((token) => placed.get(token.key)!);
}

/** A phone's map is narrower than this (px); the plate prints a few labeled counts there. */
export const PHONE_MAP_MAX_WIDTH = 768;

/**
 * The keys a phone plate prints a numeral for at the state and county levels. Largest count first
 * (ties by key), a numeral prints when its box, and its name where that also fits, clears every
 * numeral and name already printed and every obstacle by `gap` px; `keep` keys always print and
 * claim their room first. So the counts spread over the whole plate instead of the few largest
 * crowding one region, and none sits close enough to read as noise. Pure and deterministic.
 */
export function chooseUncrowded(
  tokens: readonly TokenInput[],
  obstacles: readonly Box[],
  keep: ReadonlySet<string> = new Set(),
  gap = 6,
): Set<string> {
  const grid = new Grid();
  for (const obstacle of obstacles) grid.add(obstacle);
  const chosen = new Set<string>();
  const ranked = [...tokens].sort(
    (a, b) =>
      Number(keep.has(b.key)) - Number(keep.has(a.key)) ||
      b.count - a.count ||
      (a.key < b.key ? -1 : 1),
  );
  for (const t of ranked) {
    const numeral = grow(centered(t.x, t.y, t.width, t.height), gap);
    if (!keep.has(t.key) && grid.overlap(numeral) > 0) continue;
    chosen.add(t.key);
    grid.add(numeral);
    if (!t.name) continue;
    const name = grow(
      centered(t.x + t.name.dx + t.name.width / 2, t.y, t.name.width, t.name.height),
      gap,
    );
    if (grid.overlap(name) === 0) grid.add(name);
  }
  return chosen;
}

/** The text equivalent of the plate's counts: every place in view, largest first. */
export function placeCountList(
  places: readonly { readonly key: string; readonly name: string; readonly count: number }[],
): string[] {
  return [...places]
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))
    .map(
      (p) =>
        `${p.name}, ${p.count.toLocaleString('en-US')} ${p.count === 1 ? 'record' : 'records'}`,
    );
}

/** The numeral's box as drawn (for tests and obstacle building). */
export function numeralBox(p: TokenPlacement, token: Pick<TokenInput, 'width' | 'height'>): Box {
  return centered(p.x, p.y, token.width, token.height);
}

/** A round mark's box, centered on a projected point. */
export function markBox(x: number, y: number, diameter: number): Box {
  return centered(x, y, diameter, diameter);
}
