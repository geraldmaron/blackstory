/**
 * The key under an active shading layer: one swatch and its numeric range per class, the unit, the
 * geography and the Census years, and how a place with no figure is drawn.
 *
 * Nothing here restates a boundary or a color. The ranges are read off the same classifiers the
 * layer buckets with (`bucketBlackShareTier`, `bucketBlackChangeTier`, and the tiers
 * `buildStateDensityLevels` already assigned), and the swatches are the layer's own paint
 * (`dignity-style.ts`) over the plate's land. The map draws these fills slightly lighter still
 * (the layer's own opacity), so a swatch is the class's color, not a pixel match.
 */
import React from 'react';
import { bucketBlackChangeTier, bucketBlackShareTier } from '@repo/domain/map/county-population';
import {
  DENSITY_TIER_FILL,
  POPULATION_CHANGE_TIER_FILL,
  POPULATION_CHANGE_TIER_GLYPH,
  POPULATION_SHARE_TIER_FILL,
  plateForScheme,
} from '../../lib/map-experience/dignity-style';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { ExploreLayerMode } from '../../lib/map-experience/url-state';
import { figurePagePath } from '../data/figures/figure-ids';
import { readDocumentColorScheme } from '../map-stage/color-scheme';

void React;

export type LegendRow = {
  readonly key: string;
  /** The class's paint, exactly as the layer's style expression names it. */
  readonly color: string;
  readonly range: string;
  /** A mark that says the direction without color (the change layer). */
  readonly cue?: string;
};

type ClassEdge<Tier> = { readonly at: number; readonly below: Tier; readonly above: Tier };

// shortcut: edges are read at quarter-point steps, exact while every threshold is a multiple of
// 0.25; export the thresholds from @repo/domain if one ever is not.
const STEP = 0.25;

/**
 * Where a classifier changes class between `min` and `max`. Classes are defined outward from
 * zero (`>= 5`, `<= -5`), so the bound is whichever side of the step lies farther from it.
 */
export function classEdges<Tier>(
  bucket: (value: number) => Tier,
  min: number,
  max: number,
): readonly ClassEdge<Tier>[] {
  const edges: ClassEdge<Tier>[] = [];
  for (let value = min + STEP; value <= max; value += STEP) {
    const below = bucket(value - STEP);
    const above = bucket(value);
    if (below !== above) {
      const at = Math.abs(value) > Math.abs(value - STEP) ? value : value - STEP;
      edges.push({ at, below, above });
    }
  }
  return edges;
}

/** Classes from an edge list, lowest first, each with the edges that bound it. */
function classesBetween<Tier>(edges: readonly ClassEdge<Tier>[]) {
  return edges.length === 0
    ? []
    : [
        { tier: edges[0]!.below, low: undefined, high: edges[0]!.at as number | undefined },
        ...edges.map((edge, index) => ({
          tier: edge.above,
          low: edge.at as number | undefined,
          high: edges[index + 1]?.at,
        })),
      ];
}

const signed = (points: number) =>
  points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';

/** Black share of residents, in percent, highest class first. */
export function shareLegendRows(): readonly LegendRow[] {
  type Tier = keyof typeof POPULATION_SHARE_TIER_FILL;
  return classesBetween(classEdges((value) => bucketBlackShareTier(value) as Tier, 0, 100))
    .map(({ tier, low, high }) => ({
      key: tier,
      color: POPULATION_SHARE_TIER_FILL[tier],
      range:
        low === undefined
          ? `Under ${high}%`
          : high === undefined
            ? `${low}% or more`
            : `${low}% to under ${high}%`,
    }))
    .reverse();
}

/** Change in that share, in percentage points: gains first, the neutral band, then losses. */
export function changeLegendRows(): readonly LegendRow[] {
  type Tier = keyof typeof POPULATION_CHANGE_TIER_FILL;
  return classesBetween(classEdges((value) => bucketBlackChangeTier(value) as Tier, -100, 100))
    .map(({ tier, low, high }) => ({
      key: tier,
      color: POPULATION_CHANGE_TIER_FILL[tier],
      cue: POPULATION_CHANGE_TIER_GLYPH[tier],
      range:
        low === undefined
          ? `${signed(high ?? 0)} points or lower`
          : high === undefined
            ? `${signed(low)} points or more`
            : high <= 0
              ? `Above ${signed(low)} to ${signed(high)} points`
              : low >= 0
                ? `${signed(low)} to under ${signed(high)} points`
                : `Between ${signed(low)} and ${signed(high)} points`,
    }))
    .reverse();
}

/**
 * Record density: the tiers are ranks among the states (terciles), so their ranges are whatever
 * the states in each tier hold today. A tier no state is in has no row.
 */
export function presenceLegendRows(
  levels: readonly Pick<StateDensityLevel, 'count' | 'tier'>[],
): readonly LegendRow[] {
  const count = (value: number) => value.toLocaleString('en-US');
  return (['concentrated', 'emerging', 'documented'] as const).flatMap((tier) => {
    const counts = levels.filter((level) => level.tier === tier).map((level) => level.count);
    if (counts.length === 0) return [];
    const low = Math.min(...counts);
    const high = Math.max(...counts);
    return [
      {
        key: tier,
        color: DENSITY_TIER_FILL[tier],
        range:
          low === high
            ? `${count(low)} ${low === 1 ? 'record' : 'records'}`
            : `${count(low)} to ${count(high)} records`,
      },
    ];
  });
}

export type LayerLegendPopulation = {
  readonly geo: 'state' | 'county';
  readonly decade: string;
  readonly fromDecade: string;
  readonly toDecade: string;
};

export type LayerLegendProps = {
  readonly mode: Exclude<ExploreLayerMode, 'off'>;
  /** The state tiers the density layer is drawing. */
  readonly densityLevels?: readonly Pick<StateDensityLevel, 'count' | 'tier'>[] | undefined;
  /** Which geography and Census years the population layer is drawing. */
  readonly population?: LayerLegendPopulation | undefined;
};

export function LayerLegend({ mode, densityLevels = [], population }: LayerLegendProps) {
  const plate = plateForScheme(readDocumentColorScheme());
  const rows =
    mode === 'presence'
      ? presenceLegendRows(densityLevels)
      : mode === 'blackShare'
        ? shareLegendRows()
        : changeLegendRows();
  if (rows.length === 0 || (mode !== 'presence' && !population)) return null;

  const place = population?.geo ?? 'state';
  const caption =
    mode === 'presence'
      ? 'Key. Records this archive holds in each state.'
      : mode === 'blackShare'
        ? `Key. Black residents as a percent of all residents in each ${place}, ${population?.decade} Census.`
        : `Key. Change in that percent, in percentage points, for each ${place}, from the ${population?.fromDecade} Census to the ${population?.toDecade} Census.`;
  // The layer's fallback paint can match a class's; where it does, the key says so in words.
  const twin = rows.find((row) => row.color === plate.densityUnknown);
  const missing = `${mode === 'presence' ? 'No records held' : 'No Census figure'}${
    twin ? `, drawn the same as “${twin.range}”` : ''
  }`;
  const table =
    mode === 'blackChange'
      ? {
          href: figurePagePath('D-05'),
          label: 'State changes, 2010 to 2020, as a table (figure D-05)',
        }
      : mode === 'blackShare'
        ? {
            href: figurePagePath('D-01'),
            label: 'The national share at each census, as a table (figure D-01)',
          }
        : undefined;
  const keyed: readonly LegendRow[] = [
    ...rows,
    { key: 'missing', color: plate.densityUnknown, range: missing },
  ];

  return (
    <div className="ds-xlegend">
      <p className="ds-xrefine__note">{caption}</p>
      <ul className="ds-xlegend__rows" aria-label="Key to the shading">
        {keyed.map((row) => (
          <li key={row.key} className="ds-xlegend__row">
            <span
              className="ds-xlegend__swatch"
              style={{ background: `linear-gradient(${row.color}, ${row.color}), ${plate.land}` }}
              aria-hidden="true"
            />
            {row.cue ? (
              <span className="ds-xlegend__cue" aria-hidden="true">
                {row.cue}
              </span>
            ) : null}
            {row.range}
          </li>
        ))}
      </ul>
      {table ? (
        <p className="ds-xrefine__note">
          <a href={table.href}>{table.label}</a>
        </p>
      ) : null}
    </div>
  );
}
