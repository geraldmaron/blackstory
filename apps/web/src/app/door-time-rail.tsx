/**
 * The time rail (design-direction-v11.md §4.2): the right edge of the globe is time. Dragging it
 * relights the world with the records first documented by that decade. Its top is "All time",
 * where every record is lit.
 *
 * A native range input, turned upright: keyboard, touch and assistive tech come with it, and
 * `aria-valuetext` says the decade and the counts in words. A record with no decade stays lit at
 * every position and is counted as undated, never dropped.
 */
import React from 'react';
import type { DecadeBar } from './door-decade-walk';

void React;

export type DoorTimeRailProps = {
  readonly bars: readonly DecadeBar[];
  /** The decade the world is lit through, or null for all time. */
  readonly value: number | null;
  readonly onChange: (decade: number | null) => void;
  /** Records lit at this position, and how many of them carry no decade. */
  readonly lit: number;
  readonly undated: number;
};

/** The rail's sentence, shared by the visible readout and the slider's value text. */
export function timeRailText(value: number | null, lit: number, undated: number): string {
  const records = `${lit.toLocaleString('en-US')} ${lit === 1 ? 'record' : 'records'}`;
  const tail = undated > 0 ? `, ${undated.toLocaleString('en-US')} undated` : '';
  return value === null
    ? `All time. ${records}${tail}`
    : `Through the ${value}s. ${records}${tail}`;
}

export function DoorTimeRail({ bars, value, onChange, lit, undated }: DoorTimeRailProps) {
  if (bars.length < 2) return null;
  const first = bars[0]!;
  const last = bars[bars.length - 1]!;
  // One step past the last decade is "All time".
  const max = bars.length;
  const index =
    value === null
      ? max
      : Math.max(
          0,
          bars.findIndex((bar) => bar.year === value),
        );
  return (
    <div
      className="ds-door-rail"
      data-active={value === null ? undefined : ''}
      data-ground="ink"
      data-ground-fixed=""
    >
      <p className="ds-door-rail__now" aria-hidden="true">
        {value === null ? 'All time' : `${value}s`}
      </p>
      <span className="ds-door-rail__end" aria-hidden="true">
        Now
      </span>
      <input
        className="ds-door-rail__input"
        type="range"
        min={0}
        max={max}
        step={1}
        value={index}
        aria-label="Light the map through a decade"
        aria-valuetext={timeRailText(value, lit, undated)}
        aria-orientation="vertical"
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          onChange(next >= max ? null : (bars[next]?.year ?? null));
        }}
      />
      <span className="ds-door-rail__end" aria-hidden="true">
        {first.label}
      </span>
      <p className="ds-door-rail__count" aria-hidden="true">
        {lit.toLocaleString('en-US')} lit
        {undated > 0 ? <span>{undated.toLocaleString('en-US')} undated</span> : null}
      </p>
      {value === null ? null : (
        <button type="button" className="ds-door-rail__reset" onClick={() => onChange(null)}>
          All time
        </button>
      )}
      <span className="ds-visually-hidden">Latest decade on the rail: {last.label}</span>
    </div>
  );
}
