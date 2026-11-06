/**
 * The Footprint aggregate: where the published archive stands, state by state, and how complete
 * its records are. Pure, so it is testable without a database; footprint-store.ts reads the rows.
 *
 * A row's state comes from `stateFilterValueFor`, the same function the catalog's state filter
 * uses, so a count here and the list it links to cannot disagree. The invariant callers can rely
 * on: the sum of `states[].total` plus `unassigned` equals `publishedTotal` equals `rows.length`.
 */
import { locatorPinPercent } from '../../lib/map-experience/albers-usa.js';
import {
  FOOTPRINT_STATES,
  UNASSIGNED_STATE,
  stateFilterValueFor,
} from './footprint-attribution.js';
import type { PublishedJurisdictions } from './published-jurisdictions.js';

export type FootprintStateRow = {
  readonly postalCode: string;
  readonly name: string;
  readonly total: number;
  readonly minimumRecord: number;
  readonly partialEnrichment: number;
  /** Any other or missing recordMaturity value. */
  readonly otherMaturity: number;
};

/** x and y are percent of the 960x500 locator canvas. */
export type FootprintMapBin = { readonly x: number; readonly y: number; readonly count: number };

export type Footprint = {
  readonly releaseId: string;
  readonly publishedTotal: number;
  /** Published records at minimum record, assigned to a state or not (the share's numerator). */
  readonly minimumRecordTotal: number;
  readonly states: readonly FootprintStateRow[];
  readonly emptyStates: readonly { readonly postalCode: string; readonly name: string }[];
  readonly unassigned: number;
  readonly kinds: readonly { readonly kind: string; readonly count: number }[];
  readonly mapBins: readonly FootprintMapBin[];
  /** Rows with no coordinates, or coordinates the locator projection cannot place. */
  readonly offMap: number;
};

type MutableState = {
  -readonly [K in keyof FootprintStateRow]: FootprintStateRow[K];
};

/** Bins are cells of half a percent of the canvas: about a city's worth at national scale. */
const BIN_STEP = 0.5;

function snap(value: number): number {
  return Math.round(value / BIN_STEP) * BIN_STEP;
}

export function buildFootprint(input: PublishedJurisdictions): Footprint {
  const byState = new Map<string, MutableState>();
  for (const state of FOOTPRINT_STATES) {
    byState.set(state.postalCode, {
      postalCode: state.postalCode,
      name: state.name,
      total: 0,
      minimumRecord: 0,
      partialEnrichment: 0,
      otherMaturity: 0,
    });
  }
  const kinds = new Map<string, number>();
  const bins = new Map<string, { x: number; y: number; count: number }>();
  let unassigned = 0;
  let offMap = 0;
  let minimumRecordTotal = 0;

  for (const row of input.rows) {
    if (row.recordMaturity === 'minimum_record') minimumRecordTotal += 1;
    kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);

    const value = stateFilterValueFor(row.jurisdictionLabel);
    const bucket = value === UNASSIGNED_STATE ? undefined : byState.get(value);
    if (!bucket) {
      unassigned += 1;
    } else {
      bucket.total += 1;
      if (row.recordMaturity === 'minimum_record') bucket.minimumRecord += 1;
      else if (row.recordMaturity === 'partial_enrichment') bucket.partialEnrichment += 1;
      else bucket.otherMaturity += 1;
    }

    const pin = row.lat !== null && row.lng !== null ? locatorPinPercent(row.lng, row.lat) : null;
    if (!pin) {
      offMap += 1;
      continue;
    }
    const x = snap(pin.x);
    const y = snap(pin.y);
    const key = `${x}:${y}`;
    const bin = bins.get(key);
    if (bin) bin.count += 1;
    else bins.set(key, { x, y, count: 1 });
  }

  const all = [...byState.values()];
  return {
    releaseId: input.releaseId,
    publishedTotal: input.rows.length,
    minimumRecordTotal,
    states: all
      .filter((state) => state.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    emptyStates: all
      .filter((state) => state.total === 0)
      .map(({ postalCode, name }) => ({ postalCode, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    unassigned,
    kinds: [...kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
    mapBins: [...bins.values()],
    offMap,
  };
}
