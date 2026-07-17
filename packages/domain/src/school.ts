/**
 * School names, campuses, and status history (BB-014).
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

export type SchoolStatusEntry = {
  readonly status: string;
  readonly at: string;
  readonly evidenceIds?: readonly string[];
  readonly notes?: string;
};

export type SchoolFields = {
  readonly names: readonly SchoolName[];
  readonly campuses: readonly SchoolCampus[];
  readonly statusHistory: readonly SchoolStatusEntry[];
};
