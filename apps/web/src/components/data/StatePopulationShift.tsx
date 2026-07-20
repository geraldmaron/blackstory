/**
 * Compact ranked list of state-level Black population movers for a single
 * decade pair on `/data`. Presence-of-people framing; never deficit/crime heat.
 */
import React from 'react';
import { formatStateChangeLine, rankStateMovers, type StateChangeLike } from './population-change';
import { StatePopulationShiftChart } from './StatePopulationShiftChart';

void React;

export type StatePopulationShiftProps = {
  readonly fromDecade: string;
  readonly toDecade: string;
  readonly changes: readonly StateChangeLike[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
  readonly labelledBy?: string;
};

function resolveStateName(
  stateFips: string,
  stateNameByFips: Readonly<Record<string, string>>,
): string {
  return stateNameByFips[stateFips] ?? `State ${stateFips}`;
}

export function StatePopulationShift({
  fromDecade,
  toDecade,
  changes,
  stateNameByFips,
  labelledBy,
}: StatePopulationShiftProps) {
  if (changes.length === 0) return null;
  const { gains, losses } = rankStateMovers(changes);
  if (gains.length === 0 && losses.length === 0) return null;

  return (
    <div className="ds-data-state-shift" {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}>
      <StatePopulationShiftChart
        fromDecade={fromDecade}
        toDecade={toDecade}
        changes={changes}
        stateNameByFips={stateNameByFips}
      />
      <h3 className="ds-sans ds-data-state-shift__title">
        States that moved most, {fromDecade}–{toDecade}
      </h3>
      <p className="ds-section__lede ds-data-state-shift__lede">
        Where Black population rose or fell across states (sums of county census totals). Share
        change is percentage points of each state&rsquo;s total population.
      </p>
      <div className="ds-data-state-shift__columns">
        {gains.length > 0 ? (
          <section aria-label={`Largest Black population gains, ${fromDecade} to ${toDecade}`}>
            <h4 className="ds-mono ds-data-state-shift__kicker">Largest gains</h4>
            <ol className="ds-data-state-shift__list">
              {gains.map((row) => {
                const name = resolveStateName(row.stateFips, stateNameByFips);
                return <li key={`gain-${row.stateFips}`}>{formatStateChangeLine(row, name)}</li>;
              })}
            </ol>
          </section>
        ) : null}
        {losses.length > 0 ? (
          <section aria-label={`Largest Black population losses, ${fromDecade} to ${toDecade}`}>
            <h4 className="ds-mono ds-data-state-shift__kicker">Largest losses</h4>
            <ol className="ds-data-state-shift__list">
              {losses.map((row) => {
                const name = resolveStateName(row.stateFips, stateNameByFips);
                return <li key={`loss-${row.stateFips}`}>{formatStateChangeLine(row, name)}</li>;
              })}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}
