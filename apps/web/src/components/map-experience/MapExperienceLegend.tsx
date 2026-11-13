'use client';

/**
 * How to read the map, in words and swatches. The marks say how precisely the archive can place
 * a record and nothing else: a dot is a site, a ring is a neighborhood or city, a tag at a state's
 * label counts records known only to the county or state. Kind is shown in the list and the
 * inspector, never by mark color. Copper is the selected record.
 *
 * A compact key stays visible above a native `<details>` disclosure (keyboard and screen-reader
 * support without custom JS). The opt-in area layers (record density, population share and
 * change) add their own tier rows when on.
 */
import React, { useEffect, useState } from 'react';
import {
  DENSITY_TIER_FILL,
  DIGNITY_PALETTE,
  POPULATION_CHANGE_TIER_FILL,
  POPULATION_CHANGE_TIER_GLYPH,
  POPULATION_SHARE_TIER_FILL,
  CLUSTER_RADIUS_BY_COUNT,
  plateForScheme,
  type MapColorScheme,
} from '../../lib/map-experience/dignity-style';
import type { ExploreLayerMode, ExplorePopulationGeo } from '../../lib/map-experience/url-state';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

const SHARE_TIER_ROWS = [
  ['trace', 'Under 2%'],
  ['low', '2 to 10%'],
  ['mid', '10 to 25%'],
  ['high', '25 to 50%'],
  ['majority', '50%+'],
] as const;

const CHANGE_TIER_ROWS = [
  ['gainStrong', 'Gain ≥ 5 pp'],
  ['gainModerate', 'Gain 1 to 5 pp'],
  ['neutral', 'Within ±1 pp'],
  ['lossModerate', 'Loss 1 to 5 pp'],
  ['lossStrong', 'Loss ≥ 5 pp'],
] as const;

const PRESENCE_TIER_ROWS = [
  ['documented', 'Documented'],
  ['emerging', 'Emerging'],
  ['concentrated', 'Concentrated'],
] as const;

/** Group sizes, from `CLUSTER_RADIUS_BY_COUNT`: three steps. */
const GROUP_SIZE_ROWS = [
  ['2 to 9 records', CLUSTER_RADIUS_BY_COUNT[0]![1]],
  ['10 to 99 records', CLUSTER_RADIUS_BY_COUNT[1]![1]],
  ['100 or more', CLUSTER_RADIUS_BY_COUNT[2]![1]],
] as const;

export type MapExperienceLegendProps = {
  /** Seeds the initial open/closed state of the `<details>` disclosure. Defaults to open. */
  readonly defaultCollapsed?: boolean;
  readonly layerMode?: ExploreLayerMode;
  readonly popGeo?: ExplorePopulationGeo;
  /** Optional override for tests; live UI reads `document.documentElement.dataset.theme`. */
  readonly colorScheme?: MapColorScheme;
  /** When set, renders a “Hide key” control beside the key heading (standalone chrome). */
  readonly onHide?: () => void;
  /** When true, omits the key heading/hide row: the host labels it. */
  readonly embedded?: boolean;
};

function LineSwatch(props: { readonly color: string }) {
  return (
    <span
      className="ds-legend-line-swatch"
      style={{ backgroundColor: props.color }}
      aria-hidden="true"
    />
  );
}

function MarkSwatch(props: {
  readonly size: number;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}) {
  return (
    <span
      className="ds-legend-mark"
      style={{
        width: props.size,
        height: props.size,
        backgroundColor: props.fill,
        boxShadow: `inset 0 0 0 ${props.strokeWidth}px ${props.stroke}`,
      }}
      aria-hidden="true"
    />
  );
}

function TierSwatch(props: { readonly color: string }) {
  return (
    <span
      className="ds-legend-glyph ds-legend-glyph--circle"
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
      {...(embedded ? { 'aria-label': 'Map key' } : { 'aria-labelledby': 'map-color-key-heading' })}
    >
      {embedded ? null : (
        <div className="ds-explore-stage__panel-header">
          <h3 className="ds-explore-legend__subhead" id="map-color-key-heading">
            Map key
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
          <MarkSwatch size={8} fill={plate.markInk} stroke={plate.markInk} strokeWidth={0} />
          <span>Placed at the site</span>
        </li>
        <li>
          <MarkSwatch size={14} fill="transparent" stroke={plate.markInk} strokeWidth={1.5} />
          <span>Placed to the neighborhood or city</span>
        </li>
        <li>
          <span className="ds-legend-tag" aria-hidden="true">
            3 statewide
          </span>
          <span>Placed to the county or state, counted at the state label</span>
        </li>
        <li>
          <MarkSwatch
            size={10}
            fill={DIGNITY_PALETTE.point}
            stroke={plate.selectedHalo}
            strokeWidth={2}
          />
          <span>Selected record</span>
        </li>
      </ul>
      <p className="ds-explore-legend__note">Groups of nearby records</p>
      <ul className="ds-explore-legend__kind-list">
        {GROUP_SIZE_ROWS.map(([label, radius]) => (
          <li key={label}>
            <MarkSwatch
              size={radius * 2}
              fill={plate.groupFill}
              stroke={plate.groupStroke}
              strokeWidth={1}
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <ul className="ds-explore-legend__kind-list">
        <li>
          <LineSwatch color={plate.stateBounds} />
          <span>State outline</span>
        </li>
        <li>
          <LineSwatch color={plate.countyLine} />
          <span>County line</span>
        </li>
      </ul>
      {layerMode === 'presence' ? (
        <>
          <p className="ds-explore-legend__note">Record density by state</p>
          <ul className="ds-explore-legend__kind-list">
            {PRESENCE_TIER_ROWS.map(([tier, label]) => (
              <li key={tier}>
                <TierSwatch color={DENSITY_TIER_FILL[tier]} />
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
                <TierSwatch color={POPULATION_SHARE_TIER_FILL[tier]} />
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
                <TierSwatch color={POPULATION_CHANGE_TIER_FILL[tier]} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function MapExperienceLegend(props: MapExperienceLegendProps = {}) {
  const defaultCollapsed = props.defaultCollapsed ?? false;
  const layerMode = props.layerMode ?? 'off';
  const popGeo = props.popGeo ?? 'county';
  const onHide = props.onHide;
  const embedded = props.embedded ?? false;
  // SSR and first paint use the override or light; the live theme is read after mount, so the
  // swatches never differ between server and client.
  const [colorScheme, setColorScheme] = useState<MapColorScheme>(props.colorScheme ?? 'light');

  useEffect(() => {
    if (props.colorScheme) {
      setColorScheme(props.colorScheme);
      return;
    }
    const sync = () => setColorScheme(readDocumentColorScheme());
    sync();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) sync();
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
          <dl className="ds-explore-legend__list">
            <div>
              <dt>Marks</dt>
              <dd>
                A mark is drawn only as precisely as the archive can place the record. A dot is the
                site itself. A ring is a neighborhood or a city, never a street corner. A record
                known only to its county or state gets no mark: it is counted in the tag under that
                state&rsquo;s label.
              </dd>
            </div>
            <div>
              <dt>Groups</dt>
              <dd>
                A numbered circle holds several nearby records at this zoom. Select it to zoom in
                until it splits. A group never says where any one record is.
              </dd>
            </div>
            <div>
              <dt>Kind</dt>
              <dd>
                Kind is shown in the list and in the record, not by the color of a mark. Copper
                marks the record you selected.
              </dd>
            </div>
            <div>
              <dt>Area layers</dt>
              <dd>
                {layerMode === 'off' ? (
                  <>No area shading is on. Record density and population layers are optional.</>
                ) : layerMode === 'presence' ? (
                  <>
                    States are shaded by how many documented records this archive holds there. It
                    shows where the archive has reached so far, not where history happened.
                  </>
                ) : layerMode === 'blackShare' ? (
                  <>
                    {popGeo === 'state' ? 'States' : 'Counties'} are shaded by Black share of total
                    population for the selected Census decennial vintage (published decennial
                    counts, not modeled story density).
                  </>
                ) : (
                  <>
                    {popGeo === 'state' ? 'States' : 'Counties'} are shaded by change in Black share
                    between the selected decades. Arrows in the tier list are a second signal; color
                    is never the only cue.
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Streets</dt>
              <dd>
                Road lines and names appear as you zoom in, so places can be read against a street
                network, not only state outlines.
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </div>
  );
}
