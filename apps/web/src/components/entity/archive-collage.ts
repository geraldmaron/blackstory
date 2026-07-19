/**
 * Stable shape keys for the missing-image archive collage.
 * Symbolic marks only — never presented as a likeness of the entity.
 */
export const ARCHIVE_COLLAGE_SHAPES = [
  'afro',
  'fist',
  'book',
  'pin',
  'arch',
] as const;

export type ArchiveCollageShape = (typeof ARCHIVE_COLLAGE_SHAPES)[number];

export type ArchiveCollageShapeMeta = {
  readonly id: ArchiveCollageShape;
  readonly label: string;
  /** Short accessible phrase for alt text ("an afro silhouette"). */
  readonly altNoun: string;
};

export const ARCHIVE_COLLAGE_SHAPE_META: Readonly<
  Record<ArchiveCollageShape, ArchiveCollageShapeMeta>
> = {
  afro: { id: 'afro', label: 'Afro', altNoun: 'an afro silhouette' },
  fist: { id: 'fist', label: 'Raised fist', altNoun: 'a raised-fist silhouette' },
  book: { id: 'book', label: 'Open book', altNoun: 'an open-book silhouette' },
  pin: { id: 'pin', label: 'Place pin', altNoun: 'a place-pin silhouette' },
  arch: { id: 'arch', label: 'Arch', altNoun: 'an arch silhouette' },
};

/** FNV-1a 32-bit — stable across sessions for shape assignment. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Prefer kind-appropriate shapes, then pick stably by entity id within that pool.
 */
export function selectArchiveCollageShape(
  entityId: string,
  kind?: string,
): ArchiveCollageShape {
  const pool = shapePoolForKind(kind);
  const index = hashString(entityId) % pool.length;
  return pool[index]!;
}

function shapePoolForKind(kind: string | undefined): readonly ArchiveCollageShape[] {
  switch (kind) {
    case 'person':
      return ['afro', 'fist', 'arch'];
    case 'place':
      return ['pin', 'arch'];
    case 'school':
    case 'institution':
    case 'organization':
    case 'publication':
    case 'law':
    case 'case':
      return ['book', 'arch', 'pin'];
    case 'movement':
      return ['fist', 'afro', 'arch'];
    case 'event':
      return ['pin', 'fist', 'arch'];
    default:
      return ARCHIVE_COLLAGE_SHAPES;
  }
}

export function archiveCollageAlt(input: {
  readonly entityName: string;
  readonly shape: ArchiveCollageShape;
}): string {
  const meta = ARCHIVE_COLLAGE_SHAPE_META[input.shape];
  return (
    `Black-and-white archive collage in the shape of ${meta.altNoun}. ` +
    `Symbolic mark for ${input.entityName} — not a photograph of this record.`
  );
}

export const ARCHIVE_COLLAGE_CAPTION =
  'Archive collage · symbolic mark while this record awaits a rights-cleared portrait';
