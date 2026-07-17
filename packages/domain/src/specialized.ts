/**
 * Kind-specific field bags for people, orgs, events, laws, cases, publications, artifacts, institutions.
 */
import type { LivingStatus } from './living.js';

export type PersonFields = {
  readonly livingStatus: LivingStatus;
  readonly birthYear?: number | null;
  readonly deathYear?: number | null;
  readonly biographySummary?: string;
};

export type OrganizationFields = {
  readonly orgType?: string;
  readonly foundedYear?: number | null;
  readonly dissolvedYear?: number | null;
};

export type InstitutionFields = {
  readonly institutionType?: string;
  readonly foundedYear?: number | null;
  readonly closedYear?: number | null;
};

export type EventFields = {
  readonly startAt?: string;
  readonly endAt?: string | null;
  readonly eventType?: string;
};

export type LawFields = {
  readonly enactedAt?: string;
  readonly repealedAt?: string | null;
  readonly jurisdictionId?: string;
  readonly citation?: string;
};

export type CaseFields = {
  readonly filedAt?: string;
  readonly decidedAt?: string | null;
  readonly courtName?: string;
  readonly citation?: string;
  /** Procedural status from constitution legalStatusVocabulary when known. */
  readonly proceduralStatus?: string;
};

export type PublicationFields = {
  readonly publishedAt?: string;
  readonly publisher?: string;
  readonly isbnOrIdentifier?: string;
};

export type ArtifactFields = {
  readonly artifactType?: string;
  readonly createdAtApprox?: string;
  readonly holdingInstitutionId?: string;
};
