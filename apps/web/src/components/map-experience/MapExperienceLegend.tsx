/**
 * Accessible legend for the map: explains the kind shade + glyph vocabulary, the data-driven
 * size scale, the density/coverage layer, the precision-radius affordance, and the confidence
 * glyphs in words this is the a11y peer of the map's visual legend, not a caption underneath it
 * (WCAG 1.4.1 Use of Color: every visual distinction here also has a text/glyph explanation).
 *
 * Collapsible via a native `<details>`/`<summary>` (the same disclosure pattern
 * `explore.css`'s `.bb-explore__settings` already uses elsewhere on this page) keyboard and
 * screen-reader support come from the native element, not custom JS.
 *
 * Props contract for the mounting surface (MapStage/`ExploreMapExperience`):
 *  - `defaultCollapsed` (optional, default `false`): pass `true` to start the legend closed
 *    (e.g. on a narrow viewport). This component owns its own open/closed state after that
 *    (native `<details>` toggling); the prop only seeds the initial render.
 *  - This component renders its own root element (`<details class="bb-explore-legend">`) with
 *    no built-in fixed/floating positioning. If the map surface wants it pinned as a floating
 *    bottom-left panel over the canvas, that positioning (position/inset/z-index) belongs to
 *    the wrapping container the mounting surface owns this component only guarantees its own
 *    internal layout is legible and keyboard/SR-accessible down to a 375px-wide container.
 */
import React from 'react';
import { CONFIDENCE_TIER_GLYPH } from '../../lib/map-experience/dignity-style';
import { KIND_ENCODING_ENTRIES, type MapEntityGlyph } from '../../lib/map-experience/kind-encoding';
import { MARKER_RADIUS_MAX, MARKER_RADIUS_MIN } from '../../lib/map-experience/marker-size';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

const KIND_GLYPH_CLASS: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'bb-legend-glyph--circle',
  square: 'bb-legend-glyph--square',
  diamond: 'bb-legend-glyph--diamond',
  ring: 'bb-legend-glyph--ring',
};

const SIZE_SCALE_STEPS: readonly number[] = [
  MARKER_RADIUS_MIN,
  Math.round((MARKER_RADIUS_MIN + MARKER_RADIUS_MAX) / 2),
  MARKER_RADIUS_MAX,
];

export type MapExperienceLegendProps = {
  /** Seeds the initial open/closed state of the `<details>` disclosure. Defaults to open
   * (`false`). See this module's doc comment for the full props contract. */
  readonly defaultCollapsed?: boolean;
};

export function MapExperienceLegend(props?: MapExperienceLegendProps) {
  const defaultCollapsed = props?.defaultCollapsed ?? false;
  return (
    <details className="bb-explore-legend" open={!defaultCollapsed}>
      <summary className="bb-explore-legend__summary" id="explore-legend-heading">
        Reading this map
      </summary>
      <div className="bb-explore-legend__body">
        <section aria-labelledby="explore-legend-kind-heading">
          <h3 className="bb-explore-legend__subhead" id="explore-legend-kind-heading">
            Kind
          </h3>
          <p className="bb-explore-legend__note">
            Color marks the kind of place or record only &mdash; it says nothing about the people
            connected to a place. Each kind also has its own shape, so color is never the only
            signal.
          </p>
          <ul className="bb-explore-legend__kind-list">
            {KIND_ENCODING_ENTRIES.map(([kind, entry]) => (
              <li key={kind}>
                <span
                  className={`bb-legend-glyph ${KIND_GLYPH_CLASS[entry.glyph]}`}
                  style={
                    entry.glyph === 'ring'
                      ? { backgroundColor: 'transparent', borderColor: entry.shade }
                      : { backgroundColor: entry.shade }
                  }
                  aria-hidden="true"
                />
                <span className="bb-explore-legend__kind-label">
                  {entry.label} <span className="bb-explore-legend__kind-glyph-name">({entry.glyph})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="explore-legend-size-heading">
          <h3 className="bb-explore-legend__subhead" id="explore-legend-size-heading">
            Size
          </h3>
          <div className="bb-explore-legend__size-scale" aria-hidden="true">
            {SIZE_SCALE_STEPS.map((diameter, index) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed 3-step scale, order never changes
              <span key={index} className="bb-explore-legend__size-dot" style={{ width: diameter, height: diameter }} />
            ))}
          </div>
          <p>
            A larger marker means more documented evidence on that record &mdash; small does not
            mean less true, only less evidenced so far. Confidence in that evidence is shown
            separately below, as a glyph, never by size or color alone.
          </p>
        </section>

        <dl className="bb-explore-legend__list">
          <div>
            <dt>Points</dt>
            <dd>
              A shaded circle around a marker is a radius affordance, not a boundary &mdash; it
              shows how precisely the location is known, never an exact address.
            </dd>
          </div>
          <div>
            <dt>Clusters</dt>
            <dd>
              A number inside a marker means several records are grouped at this zoom level. Zoom
              in or activate a cluster to reveal the named records inside it &mdash; every cluster
              opens to individual entities within two interactions.
            </dd>
          </div>
          <div>
            <dt>State labels</dt>
            <dd>
              Two-letter state abbreviations orient the national and regional view. The selected
              state&rsquo;s label turns copper; labels fade out as you zoom into a state.
            </dd>
          </div>
          <div>
            <dt>Density layer (optional)</dt>
            <dd>
              When turned on, states are shaded by how many documented records they contain
              &mdash; presence, not incidents or severity. Darker shading means more documented
              records, not more danger.
            </dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.high}</span> High,{' '}
              <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.medium}</span> medium,{' '}
              <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.low}</span> low confidence, and{' '}
              <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.unrated}</span> unrated reflect how
              strongly the strongest accepted claim on a record is evidenced &mdash; shown as a
              glyph and a word, never color alone.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
