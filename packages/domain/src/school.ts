/**
 * School names, campuses, and operational milestones.
 *
 * NOTE: `milestones` below is NOT the same concept as the entity-level
 * `CanonicalEntity.statusHistory` (see `./entity-status.ts`). This array records free-text
 * operational milestones ("opened", "relocated", "renamed") at a single point in time (`at`);
 * the entity-level statusHistory instead records a closed active|historic|inactive lifecycle
 * vocabulary over a validFrom/validTo window, sourced from evidence-backed claims. Both were
 * previously named `statusHistory` on the same CanonicalEntity document (one nested under
 * `school`, one at the entity's top level) with incompatible shapes
 * (`{status: string, at, evidenceIds?, notes?}` vs
 * `{status: EntityStatusValue, validFrom?, validTo?, datePrecision, basisClaimIds}`). This
 * field was renamed to `milestones` to resolve that collision. Prefer
 * `CanonicalEntity.statusHistory` / `currentStatus` (`./entity-status.ts`) for "is this school
 * currently active" questions; use `milestones` only for the free-text institutional timeline.
 */
export type SchoolName = {
  readonly name: string;
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly primary?: boolean;
};

export type SchoolCampusStatus = 'active' | 'closed' | 'relocated' | 'unknown';

export type SchoolCampus = {
  readonly id: string;
  readonly name?: string;
  /** References an EntityLocation id (historical or current). */
  readonly locationId: string;
  readonly status: SchoolCampusStatus;
  readonly validFrom?: string;
  readonly validTo?: string | null;
};

/** @deprecated Renamed to `SchoolMilestone` to resolve a naming collision with the new
 * entity-level `StatusHistoryEntry` (./entity-status.ts). Kept as an alias for source
 * compatibility only prefer `SchoolMilestone` in new code. */
export type SchoolStatusEntry = SchoolMilestone;

export type SchoolMilestone = {
  readonly status: string;
  readonly at: string;
  readonly evidenceIds?: readonly string[];
  readonly notes?: string;
};

export type SchoolFields = {
  readonly names: readonly SchoolName[];
  readonly campuses: readonly SchoolCampus[];
  readonly milestones: readonly SchoolMilestone[];
};
