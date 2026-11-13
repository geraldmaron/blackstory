/**
 * Published records by state, drawn as a tile grid: one equal square per state so a small state
 * with many records is as visible as a large one with few, and no point is drawn sharper than a
 * state. The counts are the State facet on `/records`, so the figure and the register agree.
 *
 * Shade is a neutral step from the count's rank on a log scale, never color alone: every tile
 * prints its postal code and, at desktop widths, its count. Replaces the empty "scroll to bring
 * the map here" placeholder.
 */
import React from 'react';
import Link from 'next/link';

void React;

export type StateCount = {
  readonly postal: string;
  readonly name: string;
  readonly count: number;
};

/** Column and row of each tile in an 11 by 8 grid. */
const TILES: Readonly<Record<string, readonly [number, number]>> = {
  AK: [0, 0],
  ME: [10, 0],
  VT: [9, 1],
  NH: [10, 1],
  WA: [0, 2],
  ID: [1, 2],
  MT: [2, 2],
  ND: [3, 2],
  MN: [4, 2],
  IL: [5, 2],
  WI: [6, 2],
  MI: [7, 2],
  NY: [8, 2],
  RI: [9, 2],
  MA: [10, 2],
  OR: [0, 3],
  NV: [1, 3],
  WY: [2, 3],
  SD: [3, 3],
  IA: [4, 3],
  IN: [5, 3],
  OH: [6, 3],
  PA: [7, 3],
  NJ: [8, 3],
  CT: [9, 3],
  CA: [0, 4],
  UT: [1, 4],
  CO: [2, 4],
  NE: [3, 4],
  MO: [4, 4],
  KY: [5, 4],
  WV: [6, 4],
  VA: [7, 4],
  MD: [8, 4],
  DE: [9, 4],
  AZ: [1, 5],
  NM: [2, 5],
  KS: [3, 5],
  AR: [4, 5],
  TN: [5, 5],
  NC: [6, 5],
  SC: [7, 5],
  DC: [8, 5],
  OK: [3, 6],
  LA: [4, 6],
  MS: [5, 6],
  AL: [6, 6],
  GA: [7, 6],
  HI: [0, 7],
  TX: [3, 7],
  FL: [8, 7],
};

const STEPS = 5;

/** 0 for no records, else 1..STEPS by the count's place between 1 and the largest on a log scale. */
export function shadeStep(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return STEPS;
  return Math.min(STEPS, 1 + Math.floor((Math.log(count) / Math.log(max)) * (STEPS - 1) + 1e-9));
}

const n = (value: number) => value.toLocaleString('en-US');

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function RecordsByState({
  states,
  totalRecords,
}: {
  readonly states: readonly StateCount[];
  readonly totalRecords: number;
}) {
  const drawn = states.filter((state) => TILES[state.postal] !== undefined);
  const byPostal = new Map(drawn.map((state) => [state.postal, state]));
  const max = drawn.reduce((top, state) => Math.max(top, state.count), 0);
  const located = drawn.reduce((sum, state) => sum + state.count, 0);
  const top = [...drawn].sort((a, b) => b.count - a.count).slice(0, 3);
  const withRecords = drawn.filter((state) => state.count > 0 && state.postal !== 'DC').length;
  const dc = (byPostal.get('DC')?.count ?? 0) > 0;

  return (
    <figure className="ds-about-states">
      <figcaption className="ds-about-states__title">
        The most records sit in {listNames(top.map((state) => state.name))}.
      </figcaption>
      <ol className="ds-about-states__grid" aria-label="Published records by state">
        {Object.entries(TILES).map(([postal, [column, row]]) => {
          const state = byPostal.get(postal);
          const count = state?.count ?? 0;
          return (
            <li
              key={postal}
              className="ds-about-states__tile"
              data-step={shadeStep(count, max)}
              style={{ gridColumn: column + 1, gridRow: row + 1 }}
              title={`${state?.name ?? postal}: ${n(count)} records`}
            >
              <span className="ds-about-states__postal" aria-hidden="true">
                {postal}
              </span>
              <span className="ds-about-states__count" aria-hidden="true">
                {n(count)}
              </span>
              <span className="ds-visually-hidden">
                {state?.name ?? postal}, {n(count)} {count === 1 ? 'record' : 'records'}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="ds-about-states__foot">
        <p className="ds-about-states__legend" aria-hidden="true">
          <span>Fewer</span>
          {Array.from({ length: STEPS }, (_, index) => (
            <span key={index} className="ds-about-states__swatch" data-step={index + 1} />
          ))}
          <span>More</span>
        </p>
        <p className="ds-about-states__note">
          {n(totalRecords)} published records in {withRecords} states{dc ? ' and DC' : ''}.{' '}
          {totalRecords > located
            ? `${n(totalRecords - located)} are not tied to one state and are not drawn. `
            : ''}
          <Link href="/records">Browse them by state</Link>.
        </p>
      </div>
    </figure>
  );
}
