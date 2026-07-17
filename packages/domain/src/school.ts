/**
 * School names, campuses, and operational milestones (BB-014).
 *
 * NOTE (BB-090 naming-collision reconciliation): `milestones` below is NOT the same concept as
 * the entity-level `CanonicalEntity.statusHistory` added in BB-090 (see ./entity-status.ts).
 * This array records free-text operational milestones ("opened", "relocated", "renamed") at a
 * single point in time (`at`); the entity-level statusHistory instead records a closed
 * active|historic|inactive lifecycle vocabulary over a validFrom/validTo window, sourced from
 * evidence-backed claims. Both were previously named `statusHistory` on the same CanonicalEntity
 * document (one nested under `school`, one — new in this bead — at the entity's top level) with
 * incompatible shapes ({status: string, at, evidenceIds?, notes?} vs {status: EntityStatusValue,
 * validFrom?, validTo?, datePrecision, basisClaimIds}). BB-090 resolves that collision by
 * renaming this pre-existing, differently-shaped field to `milestones`. Prefer
 * `CanonicalEntity.statusHistory` / `currentStatus()` (./entity-status.ts) for "is this school
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

/** @deprecated Renamed to `SchoolMilestone` (BB-090) to resolve a naming collision with the new
 * entity-level `StatusHistoryEntry` (./entity-status.ts). Kept as an alias for source
 * compatibility only — prefer `SchoolMilestone` in new code. */
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
