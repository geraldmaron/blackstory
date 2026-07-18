/**
 * Kind-specific field bags for people, orgs, events, laws, cases, publications, artifacts, institutions.
 */
import type { LivingStatus } from './living.js';

export type PersonFields = {
  /**
   * @deprecated black-book-mpfb: redundant with `CanonicalEntity.livingStatus` (the top-level
   * field), which is the one actually wired into `currentEntityStatus`, map rendering
   * (`map/map-source.ts`), and the living-person redaction/serialization compliance lane
   * (`packages/security/src/redaction.ts`, `serialize.ts`) — a repo-wide call-site audit found
   * exactly one non-test construction site of this nested field
   * (`packages/firebase/fixtures/firestore-seed.ts`) versus many for the top-level field, so the
   * top-level field is canonical and this one is kept only for schema/back-compat. Made optional
   * (was required) since it is no longer the source of truth; prefer `CanonicalEntity
   * .livingStatus`, and `deriveEntityLivingStatus`/`deriveLivingStatus` (`./entity.ts`,
   * `./living.ts`) for a derived guess.
   */
  readonly livingStatus?: LivingStatus;
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
