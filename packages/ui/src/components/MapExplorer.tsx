/**
 * Presentational shell for the map data platform's real geographic map.
 *
 * This component is deliberately MapLibre-agnostic: it renders the accessible
 * legend/feature list (server-render-safe, testable via renderToStaticMarkup)
 * and a `children` slot for the interactive canvas. The actual MapLibre GL JS
 * wiring lives in `apps/web` (see apps/web/src/app/map/MapLibreCanvas.tsx),
 * which is the only place `maplibre-gl` is an actual dependency keeping
 * this shared UI package free of a heavy WebGL dependency and free of a
 * client-only import that would break plain Node test execution.
 *
 * Unlike MapFrame (schematic x/y percentage pins, kept for its existing
 * consumers), this component renders real geographic entities at their
 * public (redacted) precision, produced by `buildMapSource` in
 * `@repo/domain`.
 */

import React, { type ReactNode } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import { cx } from '../utils/cx.js';
import { headingTag, subheadingLevel, type HeadingLevel } from '../utils/heading.js';

export type MapExplorerFeature = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly precision: string;
  readonly statePostalCode?: string;
};

export type MapExplorerStateAggregate = {
  readonly stateName: string;
  readonly statePostalCode: string;
  readonly count: number;
};

export type MapExplorerProps = {
  readonly title: string;
  readonly caption?: string;
  readonly features: readonly MapExplorerFeature[];
  readonly stateAggregates?: readonly MapExplorerStateAggregate[];
  readonly className?: string;
  /** Canvas area height (CSS length or px number). Defaults to 480. */
  readonly height?: number | string;
  /** Interactive map canvas, supplied by the app (e.g. a MapLibre wrapper). */
  readonly children?: ReactNode;
  /** Level of the legend title; "State presence" sits one level below. Defaults to h3. */
  readonly headingLevel?: HeadingLevel;
};

export function MapExplorer({
  title,
  caption,
  features,
  stateAggregates = [],
  className,
  height = 480,
  children,
  headingLevel = 3,
}: MapExplorerProps) {
  const Heading = headingTag(headingLevel);
  const Subheading = headingTag(subheadingLevel(headingLevel));
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <figure className={cx('ds-map-explorer', className)}>
      <div
        className="ds-map-explorer__canvas"
        style={{ height: heightStyle }}
        // The interactive canvas is a progressive-enhancement layer; the
        // legend beside it is the real accessible content (same data), so
        // assistive tech is directed there instead of into a WebGL canvas.
        aria-hidden="true"
      >
        {children}
      </div>
      <div className="ds-map-explorer__legend">
        <Heading className="ds-map-explorer__legend-title">{title}</Heading>
        {caption ? <p className="ds-map-explorer__caption">{caption}</p> : null}
        <p className="ds-map-explorer__summary">
          {features.length} location{features.length === 1 ? '' : 's'} shown at public precision.
        </p>
        <ul className="ds-map-explorer__feature-list">
          {features.map((feature) => (
            <li key={feature.id}>
              <span className="ds-map-explorer__feature-name">{feature.displayName}</span>{' '}
              <span className="ds-map-explorer__feature-meta">
                ({feature.kind} · {feature.precision}
                {feature.statePostalCode ? ` · ${feature.statePostalCode}` : ''})
              </span>
            </li>
          ))}
        </ul>
        {stateAggregates.length > 0 ? (
          <>
            <Subheading className="ds-map-explorer__legend-subtitle">State presence</Subheading>
            <ul className="ds-map-explorer__state-list">
              {stateAggregates.map((state) => (
                <li key={state.statePostalCode}>
                  {state.stateName}: {state.count}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </figure>
  );
}
