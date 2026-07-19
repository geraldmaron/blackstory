/**
 * Kind-derived symbolic record marks for entities without a rights-cleared photo.
 * Shapes are book, pin, or arch only — never presented as a likeness of the entity.
 */
export const RECORD_MARK_SHAPES = ['book', 'pin', 'arch'] as const;

export type RecordMarkShape = (typeof RECORD_MARK_SHAPES)[number];

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

export function recordMarkAlt(input: {
  readonly entityName: string;
  readonly shape: RecordMarkShape;
  readonly kindLabel?: string;
}): string {
  const meta = RECORD_MARK_SHAPE_META[input.shape];
  const kindSuffix =
    input.kindLabel !== undefined ? ` (${input.kindLabel} record)` : '';
  return (
    `Symbolic record mark in the shape of ${meta.altNoun}. ` +
    `Mark for ${input.entityName}${kindSuffix} — not a photograph of this person or place.`
  );
}

export const RECORD_MARK_CAPTION =
  'Record mark · awaits a rights-cleared photo';
