/**
 * Theme-spine "data moment": a single hydrated figure interleaved in a theme's
 * narrative essay (see repo-cqey epic). Renders on the shared Surface panel
 * convention (`--ds-rule` border, `--ds-radius-md`, `--ds-surface-raised`)
 * with a 2px copperPin left border and a faint copper wash, per the voice-study
 * artifact for "Fold stories into themes."
 *
 * Micro-visualization is chosen automatically from `moment.kind`:
 *  - 'proportion' → a quiet horizontal proportion bar (no axis, no legend)
 *  - 'series'      → a quiet inline sparkline (single stroke, endpoint dot)
 *  - anything else → no visualization
 *
 * Reveal fill respects `prefers-reduced-motion` via CSS only (no JS timers):
 * the fill animation is gated behind `@media (prefers-reduced-motion: no-preference)`.
 */
import React from 'react';

void React;

export type DataMomentMethodStance = 'juxtaposition' | 'gated causal claim';

export type DataMomentProvenance = {
  readonly source: string;
  readonly capture: string;
  readonly confidence: string;
};

export type DataMomentProportion = {
  readonly kind: 'proportion';
  readonly numerator: number;
  readonly denominator: number;
};

export type DataMomentSeriesPoint = {
  readonly label: string;
  readonly value: number;
};

export type DataMomentSeries = {
  readonly kind: 'series';
  readonly points: readonly DataMomentSeriesPoint[];
};

export type DataMomentNone = {
  readonly kind?: undefined;
};

export type DataMomentMicroViz = DataMomentProportion | DataMomentSeries | DataMomentNone;

export type DataMomentProps = {
  /** Formatted value+unit string, e.g. "2 of 211" or "$4.2M". */
  readonly figure: string;
  /** One-sentence claim describing what the figure means. */
  readonly claim: string;
  readonly provenance: DataMomentProvenance;
  readonly methodStance: DataMomentMethodStance;
  readonly microViz?: DataMomentMicroViz;
  readonly className?: string;
};

const METHOD_STANCE_TEXT: Readonly<Record<DataMomentMethodStance, string>> = {
  juxtaposition: 'Method: juxtaposition',
  'gated causal claim': 'Method: gated causal claim',
};

function formatProportionAriaLabel(proportion: DataMomentProportion): string {
  const { numerator, denominator } = proportion;
  if (denominator <= 0) {
    return `${numerator} of ${denominator}`;
  }
  const percent = (numerator / denominator) * 100;
  const rounded = percent < 1 && percent > 0 ? percent.toFixed(1) : Math.round(percent).toString();
  return `${numerator} of ${denominator}, roughly ${rounded}%`;
}

function ProportionMicroViz({ proportion }: { readonly proportion: DataMomentProportion }) {
  const { numerator, denominator } = proportion;
  const ratio = denominator > 0 ? Math.min(Math.max(numerator / denominator, 0), 1) : 0;
  const fillPercent = `${(ratio * 100).toFixed(2)}%`;
  const ariaLabel = formatProportionAriaLabel(proportion);

  return (
    <div
      className="ds-data-moment__viz ds-data-moment__viz--proportion"
      role="img"
      aria-label={ariaLabel}
    >
      <div className="ds-data-moment__proportion-track">
        <div
          className="ds-data-moment__proportion-fill"
          style={{ width: fillPercent }}
        />
      </div>
    </div>
  );
}

function summarizeSeriesTrend(points: readonly DataMomentSeriesPoint[]): string {
  if (points.length === 0) {
    return 'no data';
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (points.length === 1) {
    return `${first.label}: ${first.value}`;
  }
  if (last.value === first.value) {
    return `flat from ${first.label} to ${last.label}, holding near ${last.value}`;
  }
  const direction = last.value > first.value ? 'rising' : 'falling';
  return `${direction} from ${first.value} (${first.label}) to ${last.value} (${last.label})`;
}

function buildSparklinePath(
  points: readonly DataMomentSeriesPoint[],
  width: number,
  height: number,
  padding: number,
): { readonly path: string; readonly endpoint: { readonly x: number; readonly y: number } } | undefined {
  if (points.length === 0) {
    return undefined;
  }
  if (points.length === 1) {
    const x = width / 2;
    const y = height / 2;
    return { path: `M${x} ${y}`, endpoint: { x, y } };
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const coords = points.map((point, index) => {
    const x = padding + (usableWidth * index) / (points.length - 1);
    const normalized = (point.value - min) / span;
    const y = padding + usableHeight * (1 - normalized);
    return { x, y };
  });

  const path = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ');

  return { path, endpoint: coords[coords.length - 1]! };
}

const SPARKLINE_WIDTH = 160;
const SPARKLINE_HEIGHT = 36;
const SPARKLINE_PADDING = 4;

function SeriesMicroViz({ series }: { readonly series: DataMomentSeries }) {
  const built = buildSparklinePath(
    series.points,
    SPARKLINE_WIDTH,
    SPARKLINE_HEIGHT,
    SPARKLINE_PADDING,
  );
  if (!built) {
    return null;
  }
  const ariaLabel = summarizeSeriesTrend(series.points);

  return (
    <div className="ds-data-moment__viz ds-data-moment__viz--series">
      <svg
        className="ds-data-moment__sparkline"
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <path className="ds-data-moment__sparkline-stroke" d={built.path} pathLength={1} />
        <circle
          className="ds-data-moment__sparkline-endpoint"
          cx={built.endpoint.x}
          cy={built.endpoint.y}
          r={2.25}
        />
      </svg>
    </div>
  );
}

function renderMicroViz(microViz: DataMomentMicroViz | undefined) {
  if (!microViz || !('kind' in microViz) || microViz.kind === undefined) {
    return null;
  }
  if (microViz.kind === 'proportion') {
    return <ProportionMicroViz proportion={microViz} />;
  }
  if (microViz.kind === 'series') {
    return <SeriesMicroViz series={microViz} />;
  }
  return null;
}

export function DataMoment({
  figure,
  claim,
  provenance,
  methodStance,
  microViz,
  className,
}: DataMomentProps) {
  const rootClassName = ['ds-data-moment', className].filter(Boolean).join(' ');

  return (
    <figure className={rootClassName}>
      <p className="ds-data-moment__figure ds-mono">{figure}</p>
      <p className="ds-data-moment__claim">{claim}</p>

      {renderMicroViz(microViz)}

      <p className="ds-data-moment__provenance">
        <span className="ds-data-moment__provenance-item">
          <strong>Source</strong> {provenance.source}
        </span>
        {' · '}
        <span className="ds-data-moment__provenance-item">
          <strong>Captured</strong> {provenance.capture}
        </span>
        {' · '}
        <span className="ds-data-moment__provenance-item">
          <strong>Confidence</strong> {provenance.confidence}
        </span>
      </p>

      <p className="ds-data-moment__method-stance">{METHOD_STANCE_TEXT[methodStance]}</p>
    </figure>
  );
}
