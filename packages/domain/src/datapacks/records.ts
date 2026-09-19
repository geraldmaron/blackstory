/**
 * JSON record contracts for data-pack resources. externalId is scoped by datasetId and never
 * automatically promoted to a canonical entity id.
 */
import type { JsonValue } from '../publication/index.js';

/** Base shape every record in every resource kind carries. Extra publisher-specific fields are
 * allowed and preserved verbatim (index signature) — only `externalId` is required at this
 * layer. */
export type DataPackRecordBase = {
  readonly externalId: string;
  readonly [key: string]: JsonValue | undefined;
};

export type DataPackEntityRecord = DataPackRecordBase & {
  readonly title?: string;
  readonly entityKind?: string;
  readonly topicIds?: readonly string[];
};

export type DataPackNameRecord = DataPackRecordBase & {
  /** externalId of the entities/... record this name belongs to. */
  readonly ofExternalId?: string;
  readonly value?: string;
};

export type DataPackIdentifierRecord = DataPackRecordBase & {
  readonly ofExternalId?: string;
  readonly system?: string;
  readonly value?: string;
};

export type DataPackLocationRecord = DataPackRecordBase & {
  readonly ofExternalId?: string;
  readonly label?: string;
  readonly lat?: number;
  readonly lng?: number;
};

export type DataPackClaimRecord = DataPackRecordBase & {
  readonly subjectExternalId?: string;
  readonly predicate?: string;
  readonly object?: string;
  readonly topicIds?: readonly string[];
};

export type DataPackRelationshipRecord = DataPackRecordBase & {
  readonly fromExternalId?: string;
  readonly toExternalId?: string;
  readonly relationshipType?: string;
};

export type DataPackEvidenceRecord = DataPackRecordBase & {
  readonly ofExternalId?: string;
  readonly sourceUrl?: string;
  readonly citationLabel?: string;
};

export type DataPackRecord =
  | DataPackEntityRecord
  | DataPackNameRecord
  | DataPackIdentifierRecord
  | DataPackLocationRecord
  | DataPackClaimRecord
  | DataPackRelationshipRecord
  | DataPackEvidenceRecord;
