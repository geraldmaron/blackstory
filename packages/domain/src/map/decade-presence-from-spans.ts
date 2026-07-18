/**
 * Convenience path onto `./decade-presence.js`'s `aggregateDecadePresence` for
 * callers holding raw active spans (status-history windows, event/person
 * lifespans) rather than pre-derived decade-bucket membership: derives each
 * entity's decade buckets via `../graph/decades.js`'s `deriveActiveDecadeBuckets`
 * — the SAME function the history graph's per-decade node/edge views use —
 * then aggregates. Both entry points land on the same output shape, so "which
 * decades is this entity recognized as active in" has exactly one derivation
 * path (graph/decades.ts) regardless of which a caller uses.
 *
 * SERVER-ONLY: this file has a real dependency on `../graph/decades.js`, so it
 * must never be imported by client-side ('use client') code — see
 * `./decade-presence.ts`'s doc comment for the client-safe entry point.
 */
import {
  deriveActiveDecadeBuckets,
  type DecadeBucketEntityInput,
  type DeriveActiveDecadeBucketsOptions,
} from '../graph/decades.js';
import { aggregateDecadePresence, type DecadeStateAggregates } from './decade-presence.js';

export type DecadePresenceEntityInput = DecadeBucketEntityInput & {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
};

/**
 * Convenience path for callers holding raw active spans rather than
 * pre-derived bucket membership: derives each entity's decade buckets via
 * `deriveActiveDecadeBuckets` (`../graph/decades.js`), then aggregates via
 * `aggregateDecadePresence`.
 */
export function buildDecadePresenceAggregates(
  entities: readonly DecadePresenceEntityInput[],
  options: DeriveActiveDecadeBucketsOptions = {},
): readonly DecadeStateAggregates[] {
  return aggregateDecadePresence(
    entities.map((entity) => ({
      ...entity,
      decadeBuckets: deriveActiveDecadeBuckets(entity, options),
    })),
  );
}
