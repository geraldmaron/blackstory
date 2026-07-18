/**
 * Per-decade state presence aggregation, derived from entities' ALREADY-DERIVED
 * decade-bucket membership (however it was produced — e.g. the map layer's
 * `eraBuckets`, itself derived upstream via `deriveEraBuckets` at search-index
 * build time, `../facts/search-index.ts`). The modeling-library counterpart to
 * the map layer's decades-in-motion rendering (`apps/web`'s `decade-flow.ts`
 * consumes this directly rather than deriving decade membership itself).
 *
 * Deliberately import-free: this file is the ONE piece of the decade-presence
 * model a 'use client' component may import as a real value (`decade-flow.ts`
 * is imported by `HeroStage.tsx`), via the client-safe subpath
 * `@repo/domain/map/decade-presence` — never the top-level `@repo/domain`
 * barrel, which transitively pulls in server-only modules a browser bundle
 * cannot resolve. A relative import here (even a type-only one to `map-source.js`
 * or `../graph/decades.js`) would defeat that isolation the moment this module
 * gains a real dependency, so `MapStateAggregate`'s shape is intentionally
 * duplicated locally rather than imported — structurally identical to (and
 * therefore freely assignable with) `./map-source.js`'s `MapStateAggregate`,
 * verified by `decade-presence.test.ts` and by `apps/web`'s own usage feeding
 * this module's output straight into its density-tiering function. Callers
 * holding raw active spans instead of pre-derived buckets use
 * `./decade-presence-from-spans.js`'s `buildDecadePresenceAggregates`, which
 * layers `../graph/decades.js`'s `deriveActiveDecadeBuckets` on top of this
 * module (server-side only, never imported by client code).
 *
 * Two aggregate views per decade:
 *  - `active`: entities whose active span actually overlaps this decade (an
 *    institution that closed in the 1920s does not inflate 1980s presence).
 *  - `cumulative`: every entity documented BY this decade — arrived, even if
 *    since inactive. This is the "the archive fills in" pin-accumulation
 *    framing the map's decades-in-motion instrument plays.
 *
 * HONESTY RULE (carried from decade-flow.ts): these are documented-record
 * counts, never a population/demographic layer. Modeled Black population by
 * decade (census bead the related workstream) rides this same per-decade/per-state
 * channel later, additively — this module's shape does not need to change
 * when that ingestion lands.
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
  const byState = new Map<string, { stateFips: string; statePostalCode: string; stateName: string; count: number }>();
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
