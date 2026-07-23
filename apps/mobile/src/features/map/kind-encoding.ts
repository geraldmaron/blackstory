/**
 * Kind + kind-family + semantic-tone encoding for the native Explore map.
 * Binding doc: `docs/ui/patterns-map-entity-encoding.md`.
 * Parallels `apps/web/src/lib/map-experience/kind-encoding.ts`.
 */
import { DIGNITY_PALETTE } from './dignity-palette';

export type MapEntityGlyph = 'circle' | 'square' | 'diamond' | 'ring';

export type KindEncodingEntry = {
  readonly shade: string;
  readonly glyph: MapEntityGlyph;
  readonly label: string;
};

export type SemanticToneEncodingEntry = {
  readonly shade: string;
  readonly label: string;
};

export type MapKind =
  | 'person'
  | 'place'
  | 'school'
  | 'organization'
  | 'institution'
  | 'event'
  | 'law'
  | 'case'
  | 'publication'
  | 'artifact'
  | 'movement'
  | 'other';

export type MapSemanticTone = 'massacre' | 'plantation' | 'epicenter';

export type MapKindFamily = 'people' | 'places' | 'organizations' | 'events' | 'sources';

export type KindFamilyEncodingEntry = KindEncodingEntry & {
  readonly kinds: readonly MapKind[];
};

export const MAP_KIND_ENCODING: Readonly<Record<MapKind, KindEncodingEntry>> = {
  person: { shade: DIGNITY_PALETTE.kindPerson, glyph: 'circle', label: 'Person' },
  place: { shade: DIGNITY_PALETTE.kindPlace, glyph: 'circle', label: 'Place' },
  school: { shade: DIGNITY_PALETTE.kindSchool, glyph: 'square', label: 'School' },
  organization: { shade: DIGNITY_PALETTE.kindOrganization, glyph: 'ring', label: 'Organization' },
  institution: { shade: DIGNITY_PALETTE.kindInstitution, glyph: 'ring', label: 'Institution' },
  event: { shade: DIGNITY_PALETTE.kindEvent, glyph: 'diamond', label: 'Event' },
  law: { shade: DIGNITY_PALETTE.kindLaw, glyph: 'square', label: 'Law' },
  case: { shade: DIGNITY_PALETTE.kindCase, glyph: 'diamond', label: 'Case' },
  publication: { shade: DIGNITY_PALETTE.kindPublication, glyph: 'square', label: 'Publication' },
  artifact: { shade: DIGNITY_PALETTE.kindArtifact, glyph: 'circle', label: 'Artifact' },
  movement: { shade: DIGNITY_PALETTE.kindMovement, glyph: 'diamond', label: 'Movement' },
  other: { shade: DIGNITY_PALETTE.kindOther, glyph: 'circle', label: 'Other' },
};

export const MAP_SEMANTIC_TONE_ENCODING: Readonly<
  Record<MapSemanticTone, SemanticToneEncodingEntry>
> = {
  massacre: { shade: DIGNITY_PALETTE.kindMassacre, label: 'Massacre / atrocity' },
  plantation: { shade: DIGNITY_PALETTE.kindPlantation, label: 'Plantation' },
  epicenter: { shade: DIGNITY_PALETTE.kindEpicenter, label: 'Black epicenter' },
};

export const DEFAULT_KIND_ENCODING: KindEncodingEntry = {
  shade: DIGNITY_PALETTE.point,
  glyph: 'circle',
  label: 'Record',
};

const KIND_TO_FAMILY: Readonly<Record<MapKind, MapKindFamily>> = {
  person: 'people',
  place: 'places',
  school: 'places',
  organization: 'organizations',
  institution: 'organizations',
  movement: 'organizations',
  event: 'events',
  case: 'events',
  law: 'sources',
  publication: 'sources',
  artifact: 'sources',
  other: 'sources',
};

export const MAP_KIND_FAMILY_ENCODING: Readonly<Record<MapKindFamily, KindFamilyEncodingEntry>> = {
  people: {
    shade: DIGNITY_PALETTE.kindPerson,
    glyph: 'circle',
    label: 'People',
    kinds: ['person'],
  },
  places: {
    shade: DIGNITY_PALETTE.kindPlace,
    glyph: 'circle',
    label: 'Places',
    kinds: ['place', 'school'],
  },
  organizations: {
    shade: DIGNITY_PALETTE.kindOrganization,
    glyph: 'ring',
    label: 'Organizations',
    kinds: ['organization', 'institution', 'movement'],
  },
  events: {
    shade: DIGNITY_PALETTE.kindEvent,
    glyph: 'diamond',
    label: 'Events',
    kinds: ['event', 'case'],
  },
  sources: {
    shade: DIGNITY_PALETTE.kindLaw,
    glyph: 'square',
    label: 'Sources',
    kinds: ['law', 'publication', 'artifact', 'other'],
  },
};

const KNOWN_KINDS = Object.keys(MAP_KIND_ENCODING) as readonly MapKind[];
const KNOWN_KIND_FAMILIES = Object.keys(MAP_KIND_FAMILY_ENCODING) as readonly MapKindFamily[];

export function isKnownMapKind(kind: string): kind is MapKind {
  return (KNOWN_KINDS as readonly string[]).includes(kind);
}

export function kindEncodingFor(kind: string): KindEncodingEntry {
  return isKnownMapKind(kind) ? MAP_KIND_ENCODING[kind] : DEFAULT_KIND_ENCODING;
}

export function isKnownMapKindFamily(value: string): value is MapKindFamily {
  return (KNOWN_KIND_FAMILIES as readonly string[]).includes(value);
}

export function kindFamilyFor(kind: string): MapKindFamily {
  if (isKnownMapKind(kind)) return KIND_TO_FAMILY[kind];
  return 'sources';
}

export function kindFamilyEncodingFor(family: MapKindFamily): KindFamilyEncodingEntry {
  return MAP_KIND_FAMILY_ENCODING[family];
}

export function kindFamilyEncodingForKind(kind: string): KindFamilyEncodingEntry {
  return kindFamilyEncodingFor(kindFamilyFor(kind));
}

export function semanticToneEncodingFor(tone: string): SemanticToneEncodingEntry | undefined {
  if (tone === 'massacre' || tone === 'plantation' || tone === 'epicenter') {
    return MAP_SEMANTIC_TONE_ENCODING[tone];
  }
  return undefined;
}

export function displayEncodingFor(kind: string, mapTone?: string): KindEncodingEntry {
  const kindEntry = kindEncodingFor(kind);
  const semantic = mapTone ? semanticToneEncodingFor(mapTone) : undefined;
  if (semantic) {
    return { shade: semantic.shade, glyph: kindEntry.glyph, label: semantic.label };
  }
  const family = kindFamilyEncodingForKind(kind);
  return {
    shade: family.shade,
    glyph: kindEntry.glyph,
    label: kindEntry.label,
  };
}

export function mapToneFromTopics(topicTags: readonly string[]): MapSemanticTone | undefined {
  const normalized = topicTags.map((tag) => tag.toLowerCase());
  const blob = normalized.join(' | ');
  if (
    normalized.some(
      (tag) => tag.includes('massacre') || tag.includes('pogrom') || tag.includes('atrocity'),
    ) ||
    blob.includes('race massacre')
  ) {
    return 'massacre';
  }
  if (normalized.some((tag) => tag.includes('plantation'))) {
    return 'plantation';
  }
  if (
    normalized.some(
      (tag) =>
        tag.includes('epicenter') ||
        tag.includes('black-wall-street') ||
        tag.includes('black wall street') ||
        tag.includes('bronzeville') ||
        tag.includes('greenwood-district'),
    )
  ) {
    return 'epicenter';
  }
  return undefined;
}

export type MapToneSource = {
  readonly topicTags?: readonly string[];
  readonly topicIds?: readonly string[];
  readonly displayName?: string;
};

export function resolveMapTone(source: MapToneSource): MapSemanticTone | undefined {
  const fromTopics = mapToneFromTopics([
    ...(source.topicTags ?? []),
    ...(source.topicIds ?? []),
  ]);
  if (fromTopics) return fromTopics;

  const name = (source.displayName ?? '').trim();
  if (!name) return undefined;

  if (/\b(massacre|pogrom|atrocity)\b/i.test(name)) return 'massacre';
  if (/\bplantation\b/i.test(name)) return 'plantation';
  if (
    /\bblack\s+wall\s+street\b/i.test(name) ||
    /\bgreenwood\s+district\b/i.test(name) ||
    /\bbronzeville\b/i.test(name)
  ) {
    return 'epicenter';
  }
  return undefined;
}

export const KIND_ENCODING_ENTRIES: ReadonlyArray<
  readonly [kind: MapKind, entry: KindEncodingEntry]
> = KNOWN_KINDS.map((kind) => [kind, MAP_KIND_ENCODING[kind]] as const);

export const KIND_FAMILY_ENTRIES: ReadonlyArray<
  readonly [family: MapKindFamily, entry: KindFamilyEncodingEntry]
> = KNOWN_KIND_FAMILIES.map((family) => [family, MAP_KIND_FAMILY_ENCODING[family]] as const);

export const SEMANTIC_TONE_ENTRIES: ReadonlyArray<
  readonly [tone: MapSemanticTone, entry: SemanticToneEncodingEntry]
> = (Object.keys(MAP_SEMANTIC_TONE_ENCODING) as MapSemanticTone[]).map(
  (tone) => [tone, MAP_SEMANTIC_TONE_ENCODING[tone]] as const,
);
