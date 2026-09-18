/**
 * Aggregate documented entity presence by decade/state. Active counts require interval overlap;
 * cumulative counts include every record documented by that decade. These are catalog counts,
 * never population estimates. Keep this module import-free for the client-safe subpath;
 * raw-span callers use decade-presence-from-spans on the server.
 */

export type StatePresenceEntityInput = {
  readonly entityId: string;
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
};

/** Structurally identical to `./map-source.js`'s `MapStateAggregate` — see this
 * file's doc comment for why it is a local duplicate, not an import. */
export type StateAggregateCount = {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
  readonly count: number;
};

export type DecadeStateAggregates = {
  readonly decade: string;
  /** State aggregates over entities active DURING this decade. */
  readonly active: readonly StateAggregateCount[];
  /** State aggregates over entities documented BY (through) this decade. */
  readonly cumulative: readonly StateAggregateCount[];
};

/** Parses a decade-bucket label ("1870s") to its start year, for numeric
 * ordering — decade labels sort correctly as plain strings only by
 * coincidence of same-length positive years; comparing the parsed year is the
 * robust form and matches this codebase's existing `decadeStartOf` pattern
 * (`apps/web/src/lib/map-experience/decade-flow.ts`). */
function decadeStartYear(label: string): number {
  return Number.parseInt(label, 10);
}

function aggregateByState(
  entities: readonly StatePresenceEntityInput[],
): readonly StateAggregateCount[] {
  const byState = new Map<
    string,
    { stateFips: string; statePostalCode: string; stateName: string; count: number }
  >();
  for (const entity of entities) {
    const entry = byState.get(entity.stateFips);
    if (entry) {
      entry.count += 1;
    } else {
      byState.set(entity.stateFips, {
        stateFips: entity.stateFips,
        statePostalCode: entity.statePostalCode,
        stateName: entity.stateName,
        count: 1,
      });
    }
  }
  return [...byState.values()];
}

/**
 * Builds active + cumulative per-decade state aggregates for every decade
 * touched by any entity's decade-bucket membership, in chronological order.
 * Deterministic (sorted decade order, insertion-stable state aggregation).
 *
 * `decadeBuckets` must already be sorted ascending (as `deriveActiveDecadeBuckets`
 * and search-index `eraBuckets` both produce) — this function does not re-sort
 * per-entity buckets, only the overall decade axis. An entity with an empty
 * bucket list contributes to no decade — never guessed into one it can't
 * honestly claim.
 */
export function aggregateDecadePresence(
  entities: readonly (StatePresenceEntityInput & { readonly decadeBuckets: readonly string[] })[],
): readonly DecadeStateAggregates[] {
  const allDecades = new Set<string>();
  for (const { decadeBuckets } of entities) {
    for (const decade of decadeBuckets) allDecades.add(decade);
  }
  const sortedDecades = [...allDecades].sort((a, b) => decadeStartYear(a) - decadeStartYear(b));

  return sortedDecades.map((decade) => {
    const decadeStart = decadeStartYear(decade);
    const activeEntities: StatePresenceEntityInput[] = [];
    const cumulativeEntities: StatePresenceEntityInput[] = [];

    for (const { decadeBuckets, ...entity } of entities) {
      if (decadeBuckets.length === 0) continue;
      if (decadeBuckets.includes(decade)) activeEntities.push(entity);
      if (decadeStartYear(decadeBuckets[0]!) <= decadeStart) cumulativeEntities.push(entity);
    }

    return {
      decade,
      active: aggregateByState(activeEntities),
      cumulative: aggregateByState(cumulativeEntities),
    };
  });
}
