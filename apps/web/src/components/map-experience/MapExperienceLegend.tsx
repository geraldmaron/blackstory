'use client';

/**
 * Accessible legend for the map: explains kind shades + glyphs, semantic tones
 * (massacre / plantation / epicenter as shade-only overlays), size, density,
 * precision, and confidence (green→orange ramp with glyphs). Color is never the
 * only signal (WCAG 1.4.1). The Color Key lists the encoding vocabulary the map
 * can paint; tones do not claim a shape of their own (kind glyph is preserved).
 *
 * A compact color key stays visible above the disclosure. The longer “Reading this
 * map” guide uses a native `<details>`/`<summary>` for keyboard and screen-reader
 * support without custom JS. Explore embeds this inside the instrument chassis Color
 * key tab (`embedded`); standalone surfaces may pass `onHide`. Visibility / tab state
 * is owned by Explore URL chrome, not this component.
 */
import React, { useEffect, useState } from 'react';
import {
  CONFIDENCE_TIER_COLOR,
  CONFIDENCE_TIER_GLYPH,
  DENSITY_TIER_FILL,
  DIGNITY_PALETTE,
  POPULATION_CHANGE_TIER_FILL,
  POPULATION_CHANGE_TIER_GLYPH,
  POPULATION_SHARE_TIER_FILL,
  plateForScheme,
  type MapColorScheme,
} from '../../lib/map-experience/dignity-style';
import type { ExploreLayerMode, ExplorePopulationGeo } from '../../lib/map-experience/url-state';
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

/** Map-canvas echo of each glyph identity (MapLibre circle layers cannot draw true squares). */
const KIND_GLYPH_MAP_ECHO: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'disc',
  square: 'thick-rim disc',
  diamond: 'orbit-ring disc',
  ring: 'hollow disc',
};

const SIZE_SCALE_STEPS: readonly number[] = [
  MARKER_RADIUS_MIN,
  Math.round((MARKER_RADIUS_MIN + MARKER_RADIUS_MAX) / 2),
  MARKER_RADIUS_MAX,
];

const SHARE_TIER_ROWS = [
  ['trace', 'Under 2%'],
  ['low', '2–10%'],
  ['mid', '10–25%'],
  ['high', '25–50%'],
  ['majority', '50%+'],
] as const;

const CHANGE_TIER_ROWS = [
  ['gainStrong', 'Gain ≥ 5 pp'],
  ['gainModerate', 'Gain 1–5 pp'],
  ['neutral', 'Within ±1 pp'],
  ['lossModerate', 'Loss 1–5 pp'],
  ['lossStrong', 'Loss ≥ 5 pp'],
] as const;

const PRESENCE_TIER_ROWS = [
  ['documented', 'Documented'],
  ['emerging', 'Emerging'],
  ['concentrated', 'Concentrated'],
] as const;

export type MapExperienceLegendProps = {
  /** Seeds the initial open/closed state of the `<details>` disclosure. Defaults to open
   * (`false`). See this module's doc comment for the full props contract. */
  readonly defaultCollapsed?: boolean;
  readonly layerMode?: ExploreLayerMode;
  readonly popGeo?: ExplorePopulationGeo;
  /** Optional override for tests; live UI reads `document.documentElement.dataset.theme`. */
  readonly colorScheme?: MapColorScheme;
  /** When set, renders a “Hide key” control beside the Color key heading (standalone chrome). */
  readonly onHide?: () => void;
  /**
   * When true, omits the Color key heading/hide row — Explore’s instrument chassis already
   * labels the Color key tab and owns hide/show.
   */
  readonly embedded?: boolean;
};

function LegendSwatch(props: { readonly glyph: MapEntityGlyph; readonly shade: string }) {
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

/** Tone swatches are shade-only discs — tones never override kind shape on the map. */
function ToneSwatch(props: { readonly shade: string }) {
  return (
    <span
      className="ds-legend-glyph ds-legend-glyph--circle"
      style={{ backgroundColor: props.shade }}
      aria-hidden="true"
    />
  );
}

function LineSwatch(props: { readonly color: string }) {
  return (
    <span
      className="ds-legend-line-swatch"
      style={{ backgroundColor: props.color }}
      aria-hidden="true"
    />
  );
}

/** Live document theme — client-only (useEffect). Never call during render/SSR. */
function readDocumentColorScheme(): MapColorScheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/**
 * Stable initial scheme for SSR + first client paint. Reading `document` in the
 * useState initializer would SSR as `light` and hydrate as `dark` when the bootstrap
 * script already set `data-theme`, flipping plate-bound LineSwatch colors.
 */
function initialColorScheme(override: MapColorScheme | undefined): MapColorScheme {
  return override ?? 'light';
}

function MapColorKey(props: {
  readonly layerMode: ExploreLayerMode;
  readonly popGeo: ExplorePopulationGeo;
  readonly colorScheme: MapColorScheme;
  readonly onHide?: () => void;
  readonly embedded?: boolean;
}) {
  const { layerMode, popGeo, colorScheme, onHide, embedded = false } = props;
  const plate = plateForScheme(colorScheme);

  return (
    <div
      className={embedded ? 'ds-map-color-key ds-map-color-key--embedded' : 'ds-map-color-key'}
      {...(embedded
        ? { 'aria-label': 'Color key' }
        : { 'aria-labelledby': 'map-color-key-heading' })}
    >
      {embedded ? null : (
        <div className="ds-explore-stage__panel-header">
          <h3 className="ds-explore-legend__subhead" id="map-color-key-heading">
            Color key
          </h3>
          {onHide ? (
            <button
              type="button"
              className="ds-button ds-button--secondary ds-button--compact ds-explore-stage__panel-hide"
              aria-label="Hide key"
              onClick={onHide}
            >
              Hide key
            </button>
          ) : null}
        </div>
      )}
      <ul className="ds-explore-legend__kind-list">
        <li>
          <LineSwatch color={plate.stateBounds} />
          <span>State outline</span>
        </li>
        <li>
          <LineSwatch color={plate.countyLine} />
          <span>County line</span>
        </li>
        <li>
          <LineSwatch color={DIGNITY_PALETTE.point} />
          <span>Selected state</span>
        </li>
      </ul>
      <p className="ds-explore-legend__note">Record kinds</p>
      <ul className="ds-explore-legend__kind-list">
        {KIND_ENCODING_ENTRIES.map(([kind, entry]) => (
          <li key={kind}>
            <LegendSwatch glyph={entry.glyph} shade={entry.shade} />
            <span>
              {entry.label}{' '}
              <span className="ds-explore-legend__kind-glyph-name">
                ({entry.glyph} → {KIND_GLYPH_MAP_ECHO[entry.glyph]})
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="ds-explore-legend__note">
        Historical tones (shade only — shape stays with kind)
      </p>
      <ul className="ds-explore-legend__kind-list">
        {SEMANTIC_TONE_ENTRIES.map(([tone, entry]) => (
          <li key={tone}>
            <ToneSwatch shade={entry.shade} />
            <span>{entry.label}</span>
          </li>
        ))}
      </ul>
      {layerMode === 'presence' ? (
        <>
          <p className="ds-explore-legend__note">Record presence by state</p>
          <ul className="ds-explore-legend__kind-list">
            {PRESENCE_TIER_ROWS.map(([tier, label]) => (
              <li key={tier}>
                <span
                  className="ds-legend-glyph ds-legend-glyph--circle"
                  style={{ backgroundColor: DENSITY_TIER_FILL[tier] }}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {layerMode === 'blackShare' ? (
        <>
          <p className="ds-explore-legend__note">
            Black population share by {popGeo === 'state' ? 'state' : 'county'}
          </p>
          <ul className="ds-explore-legend__kind-list">
            {SHARE_TIER_ROWS.map(([tier, label]) => (
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
        </>
      ) : null}
      {layerMode === 'blackChange' ? (
        <>
          <p className="ds-explore-legend__note">
            Black share change by {popGeo === 'state' ? 'state' : 'county'}
          </p>
          <ul className="ds-explore-legend__kind-list">
            {CHANGE_TIER_ROWS.map(([tier, label]) => (
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
        </>
      ) : null}
      <p className="ds-explore-legend__note">
        Each map color pairs with a label or glyph — color is never the only signal. Markers on the
        canvas are discs; square / diamond / ring names are rim and fill signatures, not literal
        MapLibre shapes.
      </p>
    </div>
  );
}

export function MapExperienceLegend(props: MapExperienceLegendProps = {}) {
  const defaultCollapsed = props.defaultCollapsed ?? false;
  const layerMode = props.layerMode ?? 'presence';
  const popGeo = props.popGeo ?? 'county';
  const onHide = props.onHide;
  const embedded = props.embedded ?? false;
  const [colorScheme, setColorScheme] = useState<MapColorScheme>(() =>
    initialColorScheme(props.colorScheme),
  );

  useEffect(() => {
    if (props.colorScheme) {
      setColorScheme(props.colorScheme);
      return;
    }
    // After mount only — matches the live theme without SSR/CSR divergence.
    const sync = () => setColorScheme(readDocumentColorScheme());
    sync();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
        sync();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [props.colorScheme]);

  return (
    <div className="ds-explore-legend-stack">
      <MapColorKey
        layerMode={layerMode}
        popGeo={popGeo}
        colorScheme={colorScheme}
        embedded={embedded}
        {...(!embedded && onHide ? { onHide } : {})}
      />
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
              &mdash; it says nothing about the people connected to a place. Each kind also has a
              named shape identity (circle, square, diamond, or ring). On the map those identities
              paint as discs with matching rim or fill: thick rim for square kinds (school, law,
              publication), an orbit ring for diamond kinds (event, case, movement), and a hollow
              disc for ring kinds (organization, institution).
            </p>
            <ul className="ds-explore-legend__kind-list">
              {KIND_ENCODING_ENTRIES.map(([kind, entry]) => (
                <li key={kind}>
                  <LegendSwatch glyph={entry.glyph} shade={entry.shade} />
                  <span className="ds-explore-legend__kind-label">
                    {entry.label}{' '}
                    <span className="ds-explore-legend__kind-glyph-name">
                      ({entry.glyph} → {KIND_GLYPH_MAP_ECHO[entry.glyph]})
                    </span>
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
              When topic tags or the record title identify a massacre, plantation, or Black
              epicenter (for example Tulsa&rsquo;s Greenwood / Black Wall Street), the marker shade
              follows that tone while keeping the record&rsquo;s kind shape. Use the Tone filter to
              show only those records. A tone may be rare in the current catalog until matching
              titles or topics are present.
            </p>
            <ul className="ds-explore-legend__kind-list">
              {SEMANTIC_TONE_ENTRIES.map(([tone, entry]) => (
                <li key={tone}>
                  <ToneSwatch shade={entry.shade} />
                  <span className="ds-explore-legend__kind-label">
                    {entry.label}{' '}
                    <span className="ds-explore-legend__kind-glyph-name">(shade only)</span>
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
              {SIZE_SCALE_STEPS.map((diameter) => (
                <span
                  key={diameter}
                  className="ds-explore-legend__size-dot"
                  style={{ width: diameter, height: diameter }}
                />
              ))}
            </div>
            <p className="ds-explore-legend__note">
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
                records are grouped at this zoom level. Zoom in or activate a cluster to reveal the
                named records inside it &mdash; every cluster opens to individual entities within
                two interactions. Turn grouping off to see every disc even when zoomed out.
              </dd>
            </div>
            <div>
              <dt>Opening a record</dt>
              <dd>
                Activating a pin or a list row opens the full entity page &mdash; evidence, context,
                and chronology &mdash; not a floating preview card on the map.
              </dd>
            </div>
            <div>
              <dt>Streets</dt>
              <dd>
                Road lines and names appear as you zoom in (roughly city scale and closer) so places
                can be read against a street network, not only state outlines.
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
              <dt>County names</dt>
              <dd>County names fade in with county lines as you zoom past the national frame.</dd>
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
                    {popGeo === 'state' ? 'States' : 'Counties'} are shaded by Black share of
                    total population for the selected Census decennial vintage (published decennial
                    counts, not modeled story density).
                  </>
                ) : (
                  <>
                    {popGeo === 'state' ? 'States' : 'Counties'} are shaded by change in Black
                    share between the selected decades — copper tones mark gain, stone tones mark
                    loss. Arrows in the tier list are a second signal; color is never the only cue.
                  </>
                )}
              </dd>
            </div>
            {layerMode === 'presence' ? (
              <div>
                <dt>Record presence shading</dt>
                <dd>
                  Darker copper means more documented records in a state — never more danger, never
                  a claim that a lighter state lacks history. See the color key above for the three
                  presence tiers.
                </dd>
              </div>
            ) : null}
            {layerMode === 'blackShare' ? (
              <div>
                <dt>Black population share tiers</dt>
                <dd>See the color key above for the share tiers and labels.</dd>
              </div>
            ) : null}
            {layerMode === 'blackChange' ? (
              <div>
                <dt>Black share change tiers</dt>
                <dd>See the color key above for gain and loss tiers with arrow glyphs.</dd>
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
                low (orange), and <span aria-hidden="true">{CONFIDENCE_TIER_GLYPH.unrated}</span>{' '}
                unrated reflect how strongly the strongest accepted claim on a record is evidenced
                &mdash; shown as a glyph, a word, and a color ramp, never color alone.
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </div>
  );
}
