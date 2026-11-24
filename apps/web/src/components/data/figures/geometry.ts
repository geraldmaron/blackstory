/**
 * Geometry for the Portrait forms (docs/ui/DESIGN.md section 9.5). Pure functions from data to
 * coordinates, so each form's encoding can be tested: length along the bar for the coiled bar and
 * the folded bars, area for the stacked fields. A missing value is a gap of fixed size, never a
 * zero.
 */

export type Point = { readonly x: number; readonly y: number };

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/* —— the coiled bar: one long series, length encodes the value ———————————————— */

export type CoilItem = {
  readonly key: string;
  /** `null` is missing data: drawn as a labeled gap. */
  readonly value: number | null;
  /** A change of definition opens at this item: a short break in the bar before it. */
  readonly breakBefore?: boolean;
};

export type CoilLayout = {
  readonly width: number;
  /** Radius of the coil's outer turn, to the bar's center line. */
  readonly radius: number;
  readonly thickness: number;
  /** Distance between turns, center line to center line. */
  readonly pitch: number;
  /** Length drawn per unit of value. The one scale of the figure. */
  readonly unit: number;
  /** Length of a "no data" gap. */
  readonly gap: number;
  /** Length of the break at a definition change. */
  readonly breakLength: number;
  readonly margin: number;
};

export type CoilStretch = {
  readonly key: string;
  readonly value: number | null;
  /** The stretch's center line. Its length is `value * unit` (or `gap` when the value is null). */
  readonly points: readonly Point[];
  /** True when the stretch runs right to left, so its label is set along the reversed line. */
  readonly reversed: boolean;
};

export type CoilGeometry = {
  readonly width: number;
  readonly height: number;
  readonly stretches: readonly CoilStretch[];
  /** A short line across the bar at every stretch end, and both ends of the bar. */
  readonly ticks: readonly (readonly [Point, Point])[];
  /** The two lines of each definition break. */
  readonly breaks: readonly (readonly [Point, Point])[];
};

const STEP = 2;

/**
 * The center line: a straight run from the left edge to the top of the coil, then an Archimedean
 * spiral turning clockwise inward. Returned as a dense polyline with its running length, so a cut
 * at any length is exact on the line that is drawn.
 */
function centerLine(layout: CoilLayout, total: number): Point[] {
  const { width, radius, thickness, pitch, margin } = layout;
  const cx = width - margin - thickness / 2 - radius;
  const cy = margin + thickness / 2 + radius;
  const start = { x: margin + thickness / 2, y: cy - radius };
  const points: Point[] = [start];
  const run = Math.max(0, cx - start.x);
  for (let s = STEP; s < run; s += STEP) points.push({ x: start.x + s, y: start.y });
  points.push({ x: cx, y: start.y });
  let length = run;
  let theta = 0;
  while (length < total) {
    const r = radius - (pitch * theta) / (2 * Math.PI);
    if (r <= thickness / 2) {
      throw new Error('coiledBar: the series does not fit this layout');
    }
    theta += STEP / r;
    const rNext = radius - (pitch * theta) / (2 * Math.PI);
    const next = {
      x: cx + rNext * Math.sin(theta),
      y: cy - rNext * Math.cos(theta),
    };
    length += Math.hypot(next.x - points.at(-1)!.x, next.y - points.at(-1)!.y);
    points.push(next);
  }
  return points;
}

/** The part of `line` between running lengths `from` and `to`, with exact end points. */
function slice(line: readonly Point[], from: number, to: number): Point[] {
  const out: Point[] = [];
  let at = 0;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const lerp = (s: number) => ({
      x: a.x + ((b.x - a.x) * (s - at)) / seg,
      y: a.y + ((b.y - a.y) * (s - at)) / seg,
    });
    if (out.length === 0 && from <= at + seg) out.push(lerp(from));
    if (out.length > 0) {
      if (to <= at + seg) {
        out.push(lerp(to));
        return out;
      }
      out.push(b);
    }
    at += seg;
  }
  return out;
}

function across(points: readonly Point[], atEnd: boolean, half: number): readonly [Point, Point] {
  const a = atEnd ? points.at(-2)! : points[0]!;
  const b = atEnd ? points.at(-1)! : points[1]!;
  const p = atEnd ? b : a;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / len) * half;
  const ny = ((b.x - a.x) / len) * half;
  return [
    { x: p.x + nx, y: p.y + ny },
    { x: p.x - nx, y: p.y - ny },
  ];
}

export function coiledBar(items: readonly CoilItem[], layout: CoilLayout): CoilGeometry {
  const lengths = items.map((item) =>
    item.value === null ? layout.gap : item.value * layout.unit,
  );
  const total =
    lengths.reduce((sum, length) => sum + length, 0) +
    items.filter((item) => item.breakBefore).length * layout.breakLength;
  const line = centerLine(layout, total);
  const half = layout.thickness / 2;

  const stretches: CoilStretch[] = [];
  const ticks: (readonly [Point, Point])[] = [];
  const breaks: (readonly [Point, Point])[] = [];
  let at = 0;
  items.forEach((item, index) => {
    if (item.breakBefore) {
      const gapLine = slice(line, at, at + layout.breakLength);
      breaks.push(across(gapLine, false, half + 4), across(gapLine, true, half + 4));
      at += layout.breakLength;
    }
    const points = slice(line, at, at + lengths[index]!);
    at += lengths[index]!;
    const mid = Math.floor(points.length / 2);
    const reversed = points[mid]!.x < points[mid - 1]!.x;
    stretches.push({ key: item.key, value: item.value, points, reversed });
    ticks.push(across(points, false, half), across(points, true, half));
  });

  return {
    width: layout.width,
    height: 2 * (layout.margin + half + layout.radius),
    stretches,
    ticks,
    breaks,
  };
}

/* —— stacked proportional fields: area encodes the value ————————————————————— */

export type FieldColumn = {
  readonly key: string;
  /** Parts from the top down. A `null` part means the column has no data. */
  readonly parts: readonly { readonly id: string; readonly value: number | null }[];
};

export type FieldLayout = {
  readonly width: number;
  /** Height of every column: the whole. */
  readonly height: number;
  readonly gap: number;
};

export type FieldRect = {
  readonly key: string;
  readonly id: string;
  readonly value: number;
  /** The part's share of its column, 0 to 1. */
  readonly share: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type FieldGeometry = {
  readonly columnWidth: number;
  readonly columns: readonly {
    readonly key: string;
    readonly x: number;
    /** Empty when the column has no data. */
    readonly rects: readonly FieldRect[];
  }[];
};

/**
 * Columns of one width and one height, each divided top to bottom in proportion to its parts. A
 * part's area is its share of the column, and every column has the same area, so areas compare
 * across columns as shares do.
 */
export function stackedFields(columns: readonly FieldColumn[], layout: FieldLayout): FieldGeometry {
  const columnWidth =
    (layout.width - layout.gap * (columns.length - 1)) / Math.max(1, columns.length);
  return {
    columnWidth,
    columns: columns.map((column, index) => {
      const x = index * (columnWidth + layout.gap);
      const values = column.parts.map((part) => part.value);
      const sum = values.reduce<number>((total, value) => total + (value ?? 0), 0);
      if (values.some((value) => value === null) || sum <= 0) {
        return { key: column.key, x, rects: [] };
      }
      let y = 0;
      const rects = column.parts.map((part) => {
        const share = part.value! / sum;
        const rect: FieldRect = {
          key: column.key,
          id: part.id,
          value: part.value!,
          share,
          x,
          y,
          width: columnWidth,
          height: share * layout.height,
        };
        y += rect.height;
        return rect;
      });
      return { key: column.key, x, rects };
    }),
  };
}

/* —— folded bars: one bar a row, length encodes the value, an outlier turns back —————— */

export type FoldItem = {
  readonly key: string;
  /** `null` is missing data: drawn as a labeled gap. */
  readonly value: number | null;
};

export type FoldLayout = {
  readonly width: number;
  /** Room at the left for each bar's name. */
  readonly gutter: number;
  /** Room at the right for a value printed past a full-length run. */
  readonly labelRoom: number;
  readonly thickness: number;
  /** Distance from one bar to the next, center line to center line. */
  readonly rowHeight: number;
  /** Distance between the runs of one folded bar, center line to center line. */
  readonly foldPitch: number;
  /** Length drawn per unit of value. The one scale of the figure. */
  readonly unit: number;
  /** Length of a "no data" gap. */
  readonly gap: number;
};

export type FoldBar = {
  readonly key: string;
  readonly value: number | null;
  /** The bar's center line. Its length is `value * unit` (or `gap` when the value is null). */
  readonly points: readonly Point[];
  /** The center line of the bar's first run: where its name is set. */
  readonly y: number;
  /** 1 when the bar ends running right, -1 when it ends running left. */
  readonly direction: 1 | -1;
};

export type FoldGeometry = {
  readonly width: number;
  readonly height: number;
  /** The longest straight run: a bar longer than this turns back. */
  readonly run: number;
  readonly bars: readonly FoldBar[];
};

/**
 * One bar a row from a common left edge. A bar longer than the run turns down and runs back, as
 * many times as it needs; the turns are part of its length, so the length along its center line is
 * always `value * unit`.
 */
export function foldedBars(items: readonly FoldItem[], layout: FoldLayout): FoldGeometry {
  const left = layout.gutter;
  const run = layout.width - layout.gutter - layout.labelRoom;
  let y = layout.rowHeight / 2;
  const bars = items.map((item): FoldBar => {
    const top = y;
    let remaining = item.value === null ? layout.gap : Math.max(0, item.value) * layout.unit;
    let x = left;
    let direction: 1 | -1 = 1;
    const points: Point[] = [{ x, y }];
    for (;;) {
      const along = Math.min(remaining, run);
      x += direction * along;
      points.push({ x, y });
      remaining -= along;
      if (remaining <= 0) break;
      const down = Math.min(remaining, layout.foldPitch);
      y += down;
      points.push({ x, y });
      remaining -= down;
      if (remaining <= 0) break;
      direction = direction === 1 ? -1 : 1;
    }
    y += layout.rowHeight;
    return { key: item.key, value: item.value, points, y: top, direction };
  });
  return { width: layout.width, height: y - layout.rowHeight / 2, run, bars };
}
