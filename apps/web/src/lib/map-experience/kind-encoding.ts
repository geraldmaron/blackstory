/**
 * Kind + semantic-tone encoding for the explore map. Every kind pairs a shade
 * with a glyph so color is never the only signal (WCAG 1.4.1). Semantic tones
 * (massacre / plantation / epicenter) are derived from topic tags and override
 * kind shade at paint time while keeping the kind glyph — tones are shade-only,
 * never a second shape channel.
 *
 * Glyph identities (`circle` / `square` / `diamond` / `ring`) are the encoding
 * vocabulary. MapLibre circle layers cannot draw true squares/diamonds; the
 * canvas echoes them via rim/fill signatures (thick rim, orbit ring, hollow
 * ring). The legend may show CSS shapes as the named vocabulary mnemonic.
 */
import { DIGNITY_PALETTE } from './dignity-style';

export type MapEntityGlyph = 'circle' | 'square' | 'diamond' | 'ring';

export type KindEncodingEntry = {
  readonly shade: string;
  readonly glyph: MapEntityGlyph;
  readonly label: string;
};

/** Shade + label only — tones never own a glyph (kind shape is preserved). */
export type SemanticToneEncodingEntry = {
  readonly shade: string;
  readonly label: string;
};

/** Full domain vocabulary plus live seed kinds — unknown kinds fall back safely. */
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

const KNOWN_KINDS = Object.keys(MAP_KIND_ENCODING) as readonly MapKind[];

export function isKnownMapKind(kind: string): kind is MapKind {
  return (KNOWN_KINDS as readonly string[]).includes(kind);
}

export function kindEncodingFor(kind: string): KindEncodingEntry {
  return isKnownMapKind(kind) ? MAP_KIND_ENCODING[kind] : DEFAULT_KIND_ENCODING;
}

export function semanticToneEncodingFor(tone: string): SemanticToneEncodingEntry | undefined {
  if (tone === 'massacre' || tone === 'plantation' || tone === 'epicenter') {
    return MAP_SEMANTIC_TONE_ENCODING[tone];
  }
  return undefined;
}

/** Resolve display encoding: semantic tone wins over kind when present. */
export function displayEncodingFor(kind: string, mapTone?: string): KindEncodingEntry {
  const semantic = mapTone ? semanticToneEncodingFor(mapTone) : undefined;
  if (semantic) {
    // Tone wins on shade + label; glyph always stays with the record's kind.
    return { shade: semantic.shade, glyph: kindEncodingFor(kind).glyph, label: semantic.label };
  }
  return kindEncodingFor(kind);
}

/**
 * Derive a semantic map tone from topic tags (case-insensitive substring match).
 * Used so massacre / plantation / Black epicenter records read correctly even when
 * their canonical kind is still place/event/institution.
 */
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
        tag.includes('wall street'),
    )
  ) {
    return 'epicenter';
  }
  return undefined;
}

export const KIND_ENCODING_ENTRIES: ReadonlyArray<
  readonly [kind: MapKind, entry: KindEncodingEntry]
> = KNOWN_KINDS.map((kind) => [kind, MAP_KIND_ENCODING[kind]] as const);

export const SEMANTIC_TONE_ENTRIES: ReadonlyArray<
  readonly [tone: MapSemanticTone, entry: SemanticToneEncodingEntry]
> = (Object.keys(MAP_SEMANTIC_TONE_ENCODING) as MapSemanticTone[]).map(
  (tone) => [tone, MAP_SEMANTIC_TONE_ENCODING[tone]] as const,
);
