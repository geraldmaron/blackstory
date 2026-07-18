/**
 * Accessible legend for the map: explains kind shades + glyphs, semantic tones
 * (massacre / plantation / epicenter), size, density, precision, and confidence
 * (green→orange ramp with glyphs). Color is never the only signal (WCAG 1.4.1).
 *
 * Collapsible via a native `<details>`/`<summary>` — keyboard and screen-reader
 * support come from the native element, not custom JS.
 */
import React from 'react';
import {
  CONFIDENCE_TIER_COLOR,
  CONFIDENCE_TIER_GLYPH,
} from '../../lib/map-experience/dignity-style';
import {
  KIND_ENCODING_ENTRIES,
  SEMANTIC_TONE_ENTRIES,
  type MapEntityGlyph,
} from '../../lib/map-experience/kind-encoding';
import { MARKER_RADIUS_MAX, MARKER_RADIUS_MIN } from '../../lib/map-experience/marker-size';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

const KIND_GLYPH_CLASS: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'bp-legend-glyph--circle',
  square: 'bp-legend-glyph--square',
  diamond: 'bp-legend-glyph--diamond',
  ring: 'bp-legend-glyph--ring',
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

function LegendSwatch(props: {
  readonly glyph: MapEntityGlyph;
  readonly shade: string;
}) {
  const { glyph, shade } = props;
  return (
    <span
      className={`bp-legend-glyph ${KIND_GLYPH_CLASS[glyph]}`}
      style={
        glyph === 'ring'
          ? { backgroundColor: 'transparent', borderColor: shade }
          : { backgroundColor: shade }
      }
      aria-hidden="true"
    />
  );
}

export function MapExperienceLegend(props?: MapExperienceLegendProps) {
  const defaultCollapsed = props?.defaultCollapsed ?? false;
  return (
    <details className="bp-explore-legend" open={!defaultCollapsed}>
      <summary className="bp-explore-legend__summary" id="explore-legend-heading">
        Reading this map
      </summary>
      <div className="bp-explore-legend__body">
        <section aria-labelledby="explore-legend-kind-heading">
          <h3 className="bp-explore-legend__subhead" id="explore-legend-kind-heading">
            Kind
          </h3>
          <p className="bp-explore-legend__note">
            Color marks the kind of place or record, and a few historical tones noted below
            &mdash; it says nothing about the people connected to a place. Each entry also has
            its own shape, so color is never the only signal.
          </p>
          <ul className="bp-explore-legend__kind-list">
            {KIND_ENCODING_ENTRIES.map(([kind, entry]) => (
              <li key={kind}>
                <LegendSwatch glyph={entry.glyph} shade={entry.shade} />
                <span className="bp-explore-legend__kind-label">
                  {entry.label}{' '}
                  <span className="bp-explore-legend__kind-glyph-name">({entry.glyph})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="explore-legend-tone-heading">
          <h3 className="bp-explore-legend__subhead" id="explore-legend-tone-heading">
            Historical tones
          </h3>
          <p className="bp-explore-legend__note">
            When topic tags identify a massacre, plantation, or Black epicenter (for example
            Tulsa&rsquo;s Greenwood / Black Wall Street), the marker shade follows that tone
            while keeping the record&rsquo;s kind shape.
          </p>
          <ul className="bp-explore-legend__kind-list">
            {SEMANTIC_TONE_ENTRIES.map(([tone, entry]) => (
              <li key={tone}>
                <LegendSwatch glyph={entry.glyph} shade={entry.shade} />
                <span className="bp-explore-legend__kind-label">
                  {entry.label}{' '}
                  <span className="bp-explore-legend__kind-glyph-name">({entry.glyph})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="explore-legend-size-heading">
          <h3 className="bp-explore-legend__subhead" id="explore-legend-size-heading">
            Size
          </h3>
          <div className="bp-explore-legend__size-scale" aria-hidden="true">
            {SIZE_SCALE_STEPS.map((diameter, index) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed 3-step scale, order never changes
              <span key={index} className="bp-explore-legend__size-dot" style={{ width: diameter, height: diameter }} />
            ))}
          </div>
          <p>
            A larger marker means more documented evidence on that record &mdash; small does not
            mean less true, only less evidenced so far. Confidence in that evidence is shown
            separately below, as a glyph and a green-to-orange color, never by size alone.
          </p>
        </section>

        <dl className="bp-explore-legend__list">
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
            <dt>Streets</dt>
            <dd>
              Road lines and names appear as you zoom in (roughly city scale and closer) so
              places can be read against a street network, not only state outlines.
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
              <span style={{ color: CONFIDENCE_TIER_COLOR.high }} aria-hidden="true">
                {CONFIDENCE_TIER_GLYPH.high}
              </span>{' '}
              High (green),{' '}
              <span style={{ color: CONFIDENCE_TIER_COLOR.medium }} aria-hidden="true">
                {CONFIDENCE_TIER_GLYPH.medium}
              </span>{' '}
              medium (olive),{' '}
              <span style={{ color: CONFIDENCE_TIER_COLOR.low }} aria-hidden="true">
                {CONFIDENCE_TIER_GLYPH.low}
              </span>{' '}
              low (orange), and{' '}
              <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.unrated}</span> unrated reflect how
              strongly the strongest accepted claim on a record is evidenced &mdash; shown as a
              glyph, a word, and a color ramp, never color alone.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
