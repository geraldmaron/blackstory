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
  POPULATION_CHANGE_TIER_FILL,
  POPULATION_CHANGE_TIER_GLYPH,
  POPULATION_SHARE_TIER_FILL,
} from '../../lib/map-experience/dignity-style';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import {
  KIND_ENCODING_ENTRIES,
  SEMANTIC_TONE_ENTRIES,
  type MapEntityGlyph,
} from '../../lib/map-experience/kind-encoding';
import { MARKER_RADIUS_MAX, MARKER_RADIUS_MIN } from '../../lib/map-experience/marker-size';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

const KIND_GLYPH_CLASS: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'ds-legend-glyph--circle',
  square: 'ds-legend-glyph--square',
  diamond: 'ds-legend-glyph--diamond',
  ring: 'ds-legend-glyph--ring',
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
  readonly layerMode?: ExploreLayerMode;
};

function LegendSwatch(props: {
  readonly glyph: MapEntityGlyph;
  readonly shade: string;
}) {
  const { glyph, shade } = props;
  return (
    <span
      className={`ds-legend-glyph ${KIND_GLYPH_CLASS[glyph]}`}
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
  const layerMode = props?.layerMode ?? 'off';
  return (
    <details className="ds-explore-legend" open={!defaultCollapsed}>
      <summary className="ds-explore-legend__summary" id="explore-legend-heading">
        Reading this map
      </summary>
      <div className="ds-explore-legend__body">
        <section aria-labelledby="explore-legend-kind-heading">
          <h3 className="ds-explore-legend__subhead" id="explore-legend-kind-heading">
            Kind
          </h3>
          <p className="ds-explore-legend__note">
            Color marks the kind of place or record, and a few historical tones noted below
            &mdash; it says nothing about the people connected to a place. Each entry also has
            its own shape, so color is never the only signal.
          </p>
          <ul className="ds-explore-legend__kind-list">
            {KIND_ENCODING_ENTRIES.map(([kind, entry]) => (
              <li key={kind}>
                <LegendSwatch glyph={entry.glyph} shade={entry.shade} />
                <span className="ds-explore-legend__kind-label">
                  {entry.label}{' '}
                  <span className="ds-explore-legend__kind-glyph-name">({entry.glyph})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="explore-legend-tone-heading">
          <h3 className="ds-explore-legend__subhead" id="explore-legend-tone-heading">
            Historical tones
          </h3>
          <p className="ds-explore-legend__note">
            When topic tags identify a massacre, plantation, or Black epicenter (for example
            Tulsa&rsquo;s Greenwood / Black Wall Street), the marker shade follows that tone
            while keeping the record&rsquo;s kind shape.
          </p>
          <ul className="ds-explore-legend__kind-list">
            {SEMANTIC_TONE_ENTRIES.map(([tone, entry]) => (
              <li key={tone}>
                <LegendSwatch glyph={entry.glyph} shade={entry.shade} />
                <span className="ds-explore-legend__kind-label">
                  {entry.label}{' '}
                  <span className="ds-explore-legend__kind-glyph-name">({entry.glyph})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="explore-legend-size-heading">
          <h3 className="ds-explore-legend__subhead" id="explore-legend-size-heading">
            Size
          </h3>
          <div className="ds-explore-legend__size-scale" aria-hidden="true">
            {SIZE_SCALE_STEPS.map((diameter, index) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed 3-step scale, order never changes
              <span key={index} className="ds-explore-legend__size-dot" style={{ width: diameter, height: diameter }} />
            ))}
          </div>
          <p>
            A larger marker means more documented evidence on that record &mdash; small does not
            mean less true, only less evidenced so far. Confidence in that evidence is shown
            separately below, as a glyph and a green-to-orange color, never by size alone.
          </p>
        </section>

        <dl className="ds-explore-legend__list">
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
              When &ldquo;Group nearby&rdquo; is on, a number inside a marker means several
              records are grouped at this zoom level. Zoom in or activate a cluster to reveal
              the named records inside it &mdash; every cluster opens to individual entities
              within two interactions. Turn grouping off to see every disc even when zoomed out.
            </dd>
          </div>
          <div>
            <dt>Opening a record</dt>
            <dd>
              Activating a pin or a list row opens the full entity page &mdash; evidence,
              context, and chronology &mdash; not a floating preview card on the map.
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
            <dt>Map data model</dt>
            <dd>
              {layerMode === 'off' ? (
                <>Choose a model in the toolbar to shade geography beneath the pins.</>
              ) : layerMode === 'presence' ? (
                <>
                  States are shaded by how many documented records they contain — presence of
                  evidence in this archive, not incidents, severity, or population counts.
                </>
              ) : layerMode === 'blackShare' ? (
                <>
                  Counties are shaded by Black share of total population for the selected Census
                  decennial vintage (published decennial counts, not modeled story density).
                </>
              ) : (
                <>
                  Counties are shaded by change in Black share between the selected decades —
                  copper tones mark gain, stone tones mark loss. Arrows in the tier list are a
                  second signal; color is never the only cue.
                </>
              )}
            </dd>
          </div>
          {layerMode === 'blackShare' ? (
            <div>
              <dt>Black population share tiers</dt>
              <dd>
                <ul className="ds-explore-legend__kind-list">
                  {(
                    [
                      ['trace', 'Under 2%'],
                      ['low', '2–10%'],
                      ['mid', '10–25%'],
                      ['high', '25–50%'],
                      ['majority', '50%+'],
                    ] as const
                  ).map(([tier, label]) => (
                    <li key={tier}>
                      <span
                        className="ds-legend-glyph ds-legend-glyph--circle"
                        style={{ backgroundColor: POPULATION_SHARE_TIER_FILL[tier] }}
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {layerMode === 'blackChange' ? (
            <div>
              <dt>Black share change tiers</dt>
              <dd>
                <ul className="ds-explore-legend__kind-list">
                  {(
                    [
                      ['gainStrong', 'Gain ≥ 5 pp'],
                      ['gainModerate', 'Gain 1–5 pp'],
                      ['neutral', 'Within ±1 pp'],
                      ['lossModerate', 'Loss 1–5 pp'],
                      ['lossStrong', 'Loss ≥ 5 pp'],
                    ] as const
                  ).map(([tier, label]) => (
                    <li key={tier}>
                      <span aria-hidden="true">{POPULATION_CHANGE_TIER_GLYPH[tier]} </span>
                      <span
                        className="ds-legend-glyph ds-legend-glyph--circle"
                        style={{ backgroundColor: POPULATION_CHANGE_TIER_FILL[tier] }}
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {layerMode === 'presence' ? (
            <div>
              <dt>Record presence shading</dt>
              <dd>
                Darker copper means more documented records in a state — never more danger, never
                a claim that a lighter state lacks history.
              </dd>
            </div>
          ) : null}
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
