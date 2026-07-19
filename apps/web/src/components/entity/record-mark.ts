/**
 * Kind-derived symbolic record marks for entities without a rights-cleared photo.
 * Shapes are book, pin, or arch only — never presented as a likeness of the entity.
 * Accessible names and captions stay honest about why a mark is shown.
 */
import { sanitizePrimaryImageCreditForDisplay } from '@repo/domain';

export const RECORD_MARK_SHAPES = ['book', 'pin', 'arch'] as const;

export type RecordMarkShape = (typeof RECORD_MARK_SHAPES)[number];

/** Why the mast is showing a mark instead of (or without) a photograph. */
export type RecordMarkReason = 'absent' | 'exhausted' | 'prefer_mark';

export type RecordMarkShapeMeta = {
  readonly id: RecordMarkShape;
  readonly label: string;
  /** Short accessible phrase for alt text ("an open-book silhouette"). */
  readonly altNoun: string;
};

export const RECORD_MARK_SHAPE_META: Readonly<
  Record<RecordMarkShape, RecordMarkShapeMeta>
> = {
  book: { id: 'book', label: 'Open book', altNoun: 'an open-book silhouette' },
  pin: { id: 'pin', label: 'Place pin', altNoun: 'a place-pin silhouette' },
  arch: { id: 'arch', label: 'Arch', altNoun: 'an arch silhouette' },
};

/** Deterministic shape from entity kind — no randomness or entity-id hashing. */
export function selectRecordMarkShape(kind?: string): RecordMarkShape {
  switch (kind) {
    case 'person':
      return 'arch';
    case 'place':
    case 'event':
      return 'pin';
    case 'school':
    case 'institution':
    case 'organization':
    case 'publication':
    case 'law':
    case 'case':
      return 'book';
    case 'movement':
      return 'arch';
    default:
      return 'pin';
  }
}

const KIND_LABELS: Readonly<Record<string, string>> = {
  person: 'Person',
  place: 'Place',
  event: 'Event',
  school: 'School',
  institution: 'Institution',
  organization: 'Organization',
  publication: 'Publication',
  law: 'Law',
  case: 'Case',
  movement: 'Movement',
};

/** Human-readable kind label for mark context and captions. */
export function kindLabelForMark(kind?: string): string | undefined {
  if (!kind) {
    return undefined;
  }
  return KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * Accessible name for the symbolic mark (identity only).
 * Why the mark is shown lives in the visible figcaption and aria-describedby,
 * so screen readers are not told the same reason twice.
 */
export function recordMarkAlt(input: {
  readonly entityName: string;
  readonly shape: RecordMarkShape;
  readonly kindLabel?: string;
  readonly jurisdictionLabel?: string;
}): string {
  const meta = RECORD_MARK_SHAPE_META[input.shape];
  const kindBit =
    input.kindLabel !== undefined ? ` (${input.kindLabel} record)` : '';
  const placeBit = input.jurisdictionLabel?.trim()
    ? ` in ${input.jurisdictionLabel.trim()}`
    : '';

  return (
    `Symbolic record mark in the shape of ${meta.altNoun} for ${input.entityName}` +
    `${kindBit}${placeBit}. ` +
    `This is a symbolic mark, not a photograph of ${input.entityName}.`
  );
}

export const RECORD_MARK_CAPTION =
  'Record mark · awaits a rights-cleared photo';

/** When a published primary URL failed every candidate in the mast chain. */
export const RECORD_MARK_CAPTION_UNAVAILABLE =
  'Record mark · published photo unavailable';

/** When Save-Data prefers the symbolic mark over fetching the photo. */
export const RECORD_MARK_CAPTION_DATA_SAVER =
  'Record mark · photo deferred for data saver';

/** Visible figcaption for a given mark reason (defaults to awaits-photo). */
export function recordMarkCaption(reason?: RecordMarkReason): string {
  switch (reason) {
    case 'exhausted':
      return RECORD_MARK_CAPTION_UNAVAILABLE;
    case 'prefer_mark':
      return RECORD_MARK_CAPTION_DATA_SAVER;
    case 'absent':
    case undefined:
      return RECORD_MARK_CAPTION;
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

/**
 * Image alt for a successfully rendered primary photo.
 * Prefers the published alt; never invents "photograph of {name}" likeness claims.
 */
export function entityPrimaryImageAlt(
  publishedAlt: string | undefined,
  entityName: string,
): string {
  const trimmed = publishedAlt?.trim() ?? '';
  if (trimmed.length > 0) {
    return trimmed;
  }
  return `Photograph associated with ${entityName}`;
}

/** Human-readable rights status for photo credits (no raw snake_case). */
export function primaryImageRightsLabel(
  rightsStatus: 'public_domain' | 'licensed' | 'fair_use',
): string {
  switch (rightsStatus) {
    case 'public_domain':
      return 'public domain';
    case 'licensed':
      return 'licensed';
    case 'fair_use':
      return 'fair use';
    default: {
      const _exhaustive: never = rightsStatus;
      return _exhaustive;
    }
  }
}

/**
 * Figcaption parts for a primary image: strips Commons "Unknown author" garbage
 * and avoids duplicating the rights label already present in credit.
 */
export function primaryImageCreditCaption(input: {
  readonly credit: string;
  readonly rightsStatus: 'public_domain' | 'licensed' | 'fair_use';
}): {
  readonly creditText: string;
  readonly rightsLabel: string;
  readonly showRightsLabel: boolean;
} {
  return sanitizePrimaryImageCreditForDisplay(input);
}

/**
 * Mast photo crop bias: person portraits keep the upper frame (heads);
 * places/events stay centered.
 */
export function primaryImageFocalClass(
  kind?: string,
): 'ds-entity-photo--focal-upper' | 'ds-entity-photo--focal-center' {
  return kind === 'person' ? 'ds-entity-photo--focal-upper' : 'ds-entity-photo--focal-center';
}
