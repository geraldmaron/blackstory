/**
 * Field bag for the `movement` entity kind (BB-090 stress-test amendment) — Civil Rights
 * Movement, Great Migration, Black Power, Black Arts Movement, etc.
 *
 * A movement is a sustained, multi-actor, multi-decade phenomenon that individual
 * events/organizations resolve into via a `part_of` relationship (see ./relationship.ts) —
 * distinct from a single event's discrete when-span, which is why it is its own entity kind
 * rather than a long-duration `event`. Status vocabulary is active|historic (see
 * ./entity-status.ts `MOVEMENT_STATUSES`) — deliberately no `inactive`: a movement concludes, it
 * doesn't pause. `movement_significance` (./entity-status.ts `NOTABILITY_CRITERIA`) applies both
 * to entities associated with a movement AND to movement-kind entities themselves.
 */
export type MovementFields = {
  readonly startYear?: number;
  /** Omitted or null alongside `ongoing: true` for a movement with no documented end year. */
  readonly endYear?: number | null;
  readonly ongoing?: boolean;
  /** References to organization-kind CanonicalEntity ids central to the movement. */
  readonly keyOrganizationIds?: readonly string[];
  /** References to person-kind CanonicalEntity ids central to the movement. */
  readonly keyPersonIds?: readonly string[];
  /** References BB-091 jurisdiction ids the movement is primarily associated with. */
  readonly regionJurisdictionIds?: readonly string[];
  readonly summary?: string;
};
