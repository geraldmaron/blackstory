/**
 * The chart kit every figure on `/data`, `/lives` and `/lives/explorer` draws with.
 *
 * Text never scales with the graphic. Axes, labels and tooltips are HTML set in the type scale and
 * positioned by percentage over the plot, so a chart reads at the same size at 390px as at 1440px;
 * only the marks stretch. Lines are SVG drawn in a 0 to 100 box with `preserveAspectRatio="none"`
 * and non-scaling strokes, so they stay 2px whatever the aspect.
 *
 * Coordinates are percentages: `x` 0 at the left edge of the plot to 100 at the right, `y` 0 at
 * the baseline to 100 at the top. Color is never the identity channel on its own: every series is
 * named in a direct label, the tooltip and the table.
 *
 * Tones: `hi` is the one highlighted series (ink), `lo` the neutral comparison, `mid` a third
 * neutral step for a part of a whole. Copper is not a series color: it is reserved for the current
 * thing on the page.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { cx } from '@repo/ui';
import { ChartMarks } from './ChartMarks';

void React;

export type Tone = 'hi' | 'lo' | 'mid';

export type AxisTick = {
  /** Position along the axis, 0 to 100. */
  readonly at: number;
  readonly label: string;
  /** Hidden when the plot is narrow, so a phone keeps every other label. */
  readonly minor?: boolean;
};

const pct = (value: number) => `${Math.round(value * 100) / 100}%`;

/** Which way a tooltip opens, so one near an edge stays inside the plot. */
function tipSide(x: number): 'start' | 'center' | 'end' {
  if (x < 18) return 'start';
  if (x > 82) return 'end';
  return 'center';
}

export type PlotProps = {
  /** What the marks plot, in words, for the marks group's accessible name. */
  readonly label: string;
  /** The y unit, set once above the axis ("Percent of the U.S. population"). */
  readonly unit?: string;
  readonly yTicks: readonly AxisTick[];
  readonly xTicks: readonly AxisTick[];
  readonly size?: 'sm' | 'md' | 'lg';
  /** Room for the y labels. */
  readonly yWidth?: string;
  /** Room to the right of the plot for end labels. */
  readonly endWidth?: string;
  /**
   * Parts that cannot be named on the marks (a stack too thin to label). Set beside the unit,
   * each keyed by a swatch drawn like its mark.
   */
  readonly keys?: readonly {
    readonly label: string;
    readonly tone: Tone;
    readonly hatched?: boolean;
  }[];
  readonly children: ReactNode;
  readonly className?: string;
};

export function Plot({
  label,
  unit,
  yTicks,
  xTicks,
  size = 'md',
  yWidth = '2.75rem',
  endWidth,
  keys,
  children,
  className,
}: PlotProps) {
  return (
    <div
      className={cx('ds-plot', `ds-plot--${size}`, className)}
      style={
        {
          '--plot-y-w': yWidth,
          '--plot-end-w': endWidth ?? '0px',
        } as CSSProperties
      }
    >
      {unit || keys ? (
        <p className="ds-plot__unit">
          {unit}
          {keys?.map((key) => (
            <span key={key.label} className="ds-plot__key">
              <span
                className="ds-plot__swatch"
                data-tone={key.tone}
                data-hatched={key.hatched ? 'true' : undefined}
                aria-hidden="true"
              />
              {key.label}
            </span>
          ))}
        </p>
      ) : null}
      <div className="ds-plot__frame">
        <div className="ds-plot__y" aria-hidden="true">
          {yTicks.map((tick) => (
            <span key={tick.at} className="ds-plot__ytick" style={{ bottom: pct(tick.at) }}>
              {tick.label}
            </span>
          ))}
        </div>
        <ChartMarks label={label} className="ds-plot__area">
          <div className="ds-plot__grid" aria-hidden="true">
            {yTicks.map((tick) => (
              <span
                key={tick.at}
                className="ds-plot__gridline"
                data-zero={tick.at === 0 ? 'true' : undefined}
                style={{ bottom: pct(tick.at) }}
              />
            ))}
          </div>
          {children}
        </ChartMarks>
        <div className="ds-plot__x" aria-hidden="true">
          {xTicks.map((tick) => (
            <span
              key={`${tick.at}-${tick.label}`}
              className="ds-plot__xtick"
              data-minor={tick.minor ? 'true' : undefined}
              style={{ left: pct(tick.at) }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export type TipRow = {
  readonly value: string;
  readonly label: string;
  readonly tone?: Tone | 'none';
};

/** Values lead, labels follow; keyed with a short stroke, never a box. */
export function Tip({ title, rows }: { readonly title: string; readonly rows: readonly TipRow[] }) {
  return (
    <span className="ds-tip" aria-hidden="true">
      <span className="ds-tip__title">{title}</span>
      {rows.map((row) => (
        <span key={row.label} className="ds-tip__row">
          {row.tone && row.tone !== 'none' ? (
            <span className="ds-tip__key" data-tone={row.tone} />
          ) : null}
          <span className="ds-tip__value">{row.value}</span>
          <span className="ds-tip__label">{row.label}</span>
        </span>
      ))}
    </span>
  );
}

export type MarkProps = {
  /** Center of the mark's band, 0 to 100. */
  readonly x: number;
  /** Width of the band, 0 to 100. The band is the hit target, wider than what it draws. */
  readonly width: number;
  /** Everything the tooltip says, in one sentence, for assistive tech. */
  readonly ariaLabel: string;
  /** Where the tooltip sits, 0 to 100. */
  readonly tipY: number;
  readonly tip: ReactNode;
  /** The first mark is the group's tab stop; ChartMarks moves it. */
  readonly first: boolean;
  /** Draw a hairline down the band on hover and focus (line charts). */
  readonly crosshair?: boolean;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
  /** The id of the region a selecting mark changes. */
  readonly controls?: string;
  readonly children?: ReactNode;
};

/**
 * One focusable data position: a full-height band carrying its marks, its tooltip and its label.
 * With `onSelect` it is a button (the Lives decade arc), otherwise a focusable readout.
 */
export function Mark({
  x,
  width,
  ariaLabel,
  tipY,
  tip,
  first,
  crosshair = false,
  selected,
  onSelect,
  controls,
  children,
}: MarkProps) {
  const style = {
    left: pct(x),
    width: pct(width),
    '--tip-y': pct(Math.min(100, Math.max(0, tipY))),
  } as CSSProperties;
  const common = {
    className: cx('ds-mark', crosshair && 'ds-mark--crosshair'),
    'data-mark': '',
    'data-side': tipSide(x),
    'data-selected': selected ? 'true' : undefined,
    tabIndex: first ? 0 : -1,
    'aria-label': ariaLabel,
    style,
  };
  if (onSelect) {
    return (
      <button
        type="button"
        {...common}
        aria-pressed={selected ?? false}
        aria-controls={controls}
        onClick={onSelect}
      >
        {children}
        {tip}
      </button>
    );
  }
  return (
    <span role="img" {...common}>
      {children}
      {tip}
    </span>
  );
}

/** A filled bar (or a stack of parts) from the baseline, inside a Mark. */
export function Bar({
  height,
  tone = 'hi',
  offset = 0,
  thickness,
  shift = 0,
  hatched = false,
}: {
  /** 0 to 100. */
  readonly height: number;
  readonly tone?: Tone;
  /** Start above the baseline, 0 to 100 (a stacked part). */
  readonly offset?: number;
  /** Bar width as a share of its band, 0 to 100. */
  readonly thickness?: number;
  /** Horizontal shift from the band center, as a share of the band (grouped bars). */
  readonly shift?: number;
  readonly hatched?: boolean;
}) {
  if (height <= 0) return null;
  return (
    <span
      className="ds-fig-bar"
      data-tone={tone}
      data-hatched={hatched ? 'true' : undefined}
      data-top={offset > 0 ? 'stacked' : undefined}
      style={
        {
          bottom: pct(offset),
          height: pct(height),
          '--bar-w': thickness === undefined ? undefined : pct(thickness),
          '--bar-shift': pct(shift),
        } as CSSProperties
      }
    />
  );
}

export type LinePoint = { readonly x: number; readonly y: number } | null;

export type LineSeries = {
  readonly id: string;
  /** A null point breaks the line: a missing value is never bridged. */
  readonly points: readonly LinePoint[];
  readonly tone: Tone;
  /** Draw the series dashed (a third neutral series, or a series after a definition change). */
  readonly dashed?: boolean;
  /** Fill a ~10% wash under the line to the baseline. */
  readonly area?: boolean;
};

function segments(points: readonly LinePoint[]): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point === null) {
      if (current.length > 0) out.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

const svgPoints = (run: readonly { x: number; y: number }[]) =>
  run.map((point) => `${point.x.toFixed(2)},${(100 - point.y).toFixed(2)}`).join(' ');

/** Every series as 2px lines, broken wherever a point is missing. Dots are separate HTML marks. */
export function Lines({ series }: { readonly series: readonly LineSeries[] }) {
  return (
    <svg
      className="ds-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {series.flatMap((line) =>
        segments(line.points).flatMap((run, index) => {
          const key = `${line.id}-${index}`;
          const shapes = [];
          if (line.area && run.length > 1) {
            const first = run[0]!;
            const last = run.at(-1)!;
            shapes.push(
              <polygon
                key={`${key}-area`}
                className="ds-lines__area"
                data-tone={line.tone}
                points={`${first.x},100 ${svgPoints(run)} ${last.x},100`}
              />,
            );
          }
          if (run.length > 1) {
            shapes.push(
              <polyline
                key={key}
                className="ds-lines__line"
                data-tone={line.tone}
                data-dashed={line.dashed ? 'true' : undefined}
                points={svgPoints(run)}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
          return shapes;
        }),
      )}
    </svg>
  );
}

/** A data point: an 8px dot with a 2px surface ring. A lone point gets one so it is never lost. */
export function Dot({
  x,
  y,
  tone = 'hi',
  hollow = false,
  size = 'md',
}: {
  readonly x: number;
  readonly y: number;
  readonly tone?: Tone;
  readonly hollow?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className="ds-dot"
      data-tone={tone}
      data-hollow={hollow ? 'true' : undefined}
      data-size={size}
      style={{ left: pct(x), bottom: pct(y) }}
      aria-hidden="true"
    />
  );
}

/** A value or name set beside one point: the peak, the latest, a break. Used sparingly. */
export function PointLabel({
  x,
  y,
  children,
  place = 'above',
  strong = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly children: ReactNode;
  readonly place?: 'above' | 'below' | 'left' | 'right';
  readonly strong?: boolean;
}) {
  return (
    <span
      className="ds-point-label"
      data-place={place}
      data-side={tipSide(x)}
      data-strong={strong ? 'true' : undefined}
      style={{ left: pct(x), bottom: pct(y) }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export type EndLabelItem = {
  readonly id: string;
  readonly y: number;
  readonly name: string;
  readonly value?: string;
  readonly tone: Tone;
};

/**
 * Series names at the right edge of the plot, level with each series' last value. Labels that
 * would touch are pushed apart by a minimum gap and keep a hairline leader to their point.
 */
export function EndLabels({
  items,
  minGap = 14,
}: {
  readonly items: readonly EndLabelItem[];
  readonly minGap?: number;
}) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const placed: { item: EndLabelItem; at: number }[] = [];
  for (const item of sorted) {
    const previous = placed.at(-1);
    const at = previous && previous.at - item.y < minGap ? previous.at - minGap : item.y;
    placed.push({ item, at });
  }
  // If the stack ran below the baseline, lift the whole stack back up.
  const lowest = placed.at(-1)?.at ?? 0;
  const lift = lowest < 0 ? -lowest : 0;
  return (
    <>
      {placed.map(({ item, at }) => (
        <span
          key={item.id}
          className="ds-end-label"
          data-tone={item.tone}
          style={
            {
              bottom: pct(at + lift),
              '--leader': pct(item.y - (at + lift)),
            } as CSSProperties
          }
          aria-hidden="true"
        >
          {item.name ? <span className="ds-end-label__name">{item.name}</span> : null}
          {item.value ? <span className="ds-end-label__value">{item.value}</span> : null}
        </span>
      ))}
    </>
  );
}

/**
 * A labeled span across the plot: `gap` is hatched and means the source published nothing there;
 * `break` is a plain tint and means the numbers on either side were measured differently.
 */
export function Band({
  from,
  to,
  label,
  kind,
}: {
  readonly from: number;
  readonly to: number;
  readonly label: string;
  readonly kind: 'gap' | 'break';
}) {
  return (
    <span
      className="ds-fig-band"
      data-kind={kind}
      data-side={tipSide((from + to) / 2)}
      data-wide={to - from >= 10 ? 'true' : undefined}
      style={{ left: pct(from), width: pct(Math.max(0.6, to - from)) }}
    >
      {label ? <span className="ds-fig-band__label">{label}</span> : null}
    </span>
  );
}

/** A labeled vertical rule: where a definition changed, or the decade a reader picked. */
export function Rule({
  at,
  label,
  kind = 'note',
  minor = false,
}: {
  readonly at: number;
  readonly label?: string;
  readonly kind?: 'note' | 'current';
  /** Hide the label when the plot is narrow, where it would meet its neighbor. */
  readonly minor?: boolean;
}) {
  return (
    <span
      className="ds-rule"
      data-kind={kind}
      data-side={tipSide(at)}
      data-minor={minor ? 'true' : undefined}
      style={{ left: pct(at) }}
      aria-hidden="true"
    >
      {label ? <span className="ds-rule__label">{label}</span> : null}
    </span>
  );
}

/* —— scales and number formats ——————————————————————————————————————————————— */

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * A value axis from zero: round tick steps and the lowest round top that holds `max`, trying
 * three to six intervals and keeping the tightest fit.
 */
export function valueScale(
  max: number,
  format: (value: number) => string,
): { readonly top: number; readonly ticks: readonly AxisTick[] } {
  if (max <= 0) return { top: 1, ticks: [{ at: 0, label: format(0) }] };
  let best = { top: Infinity, step: 1 };
  for (let count = 3; count <= 6; count += 1) {
    const step = niceStep(max / count);
    const top = Math.ceil(max / step - 1e-9) * step;
    if (top < best.top) best = { top, step };
  }
  const count = Math.round(best.top / best.step);
  return {
    top: best.top,
    ticks: Array.from({ length: count + 1 }, (_, index) => ({
      at: (index / count) * 100,
      label: format(best.step * index),
    })),
  };
}

/** 12,500,000 → "12.5M"; 285,000 → "285K". For axis ticks only; values print in full. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(value / 1_000)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function trim(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** Centers of `count` equal bands across the plot, and their width. */
export function bandLayout(count: number): {
  readonly center: (index: number) => number;
  readonly width: number;
} {
  const width = 100 / Math.max(1, count);
  return { center: (index) => width * (index + 0.5), width };
}

/**
 * Category ticks for `labels` placed at band centers. On a long run only every `step`-th label is
 * shown, the rest marked minor, and the last label is always kept.
 */
export function categoryTicks(
  labels: readonly string[],
  center: (index: number) => number,
  step: number,
): readonly AxisTick[] {
  return labels.flatMap((label, index) => {
    const last = index === labels.length - 1;
    const onStep = index % step === 0 && labels.length - 1 - index >= Math.ceil(step / 2);
    if (!last && !onStep) return [];
    const minor = labels.length > 6 && !last && index % (step * 2) !== 0;
    return [{ at: center(index), label, minor }];
  });
}
