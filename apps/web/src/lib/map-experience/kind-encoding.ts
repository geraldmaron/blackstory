/**
 * Kind -> shade + glyph encoding table for the `/explore` map (BB-099).
 *
 * Every rendered entity kind gets a brand-palette shade AND a non-color glyph identity, so kind
 * is never distinguished by hue alone (WCAG 1.4.1 Use of Color). Shades never read as status,
 * racial, or skin coding: they encode ENTITY KIND ONLY, stated plainly in the legend
 * (`MapExperienceLegend.tsx`). Colors are pulled exclusively from `DIGNITY_PALETTE`
 * (`dignity-style.ts`), itself sourced from `@blap/ui`'s brand palette zero ad-hoc hex.
 *
 * The live `kind` vocabulary for the active release is `place | school | event | institution`
 * (`apps/web/src/data/public-seed.ts`'s `PublicEntityKind`, passed through verbatim by
 * `build-explore-map-source.ts`'s `enrichFeature`). The full canonical entity-kind vocabulary
 * (`@blap/domain`'s `ENTITY_KINDS`) has eight more kinds with no seed data yet;
 * `DEFAULT_KIND_ENCODING` is the render-time fallback for any of those once they reach the map,
 * so a future kind can never silently render colorless/unstyled.
 *
 * Glyph identifiers name a genuine visual signature, not just a label:
 *  - `MapExperienceLegend` renders the literal shape via CSS (circle/square/diamond/ring are all
 *    trivial CSS shapes: border-radius, a 45deg rotate).
 *  - `explore-style.ts`'s MapLibre paint approximates the same glyph identity using only
 *    `circle`-type layer paint (fill/opacity/stroke signatures plus, for `event`, a second thin
 *    overlay ring layer), because MapLibre `circle` layers cannot render non-round geometry, and
 *    this style has no icon sprite / glyph server to draw literal squares or diamonds via
 *    `symbol` layers (ADR-013 "known gaps" the same reason the cluster-count label is already a
 *    documented no-op in `explore-style.ts`). See that file's kind -> paint-signature mapping
 *    for exactly how each glyph renders on the canvas.
 */
import { DIGNITY_PALETTE } from './dignity-style';

export type MapEntityGlyph = 'circle' | 'square' | 'diamond' | 'ring';

export type KindEncodingEntry = {
  readonly shade: string;
  readonly glyph: MapEntityGlyph;
  readonly label: string;
};

export type MapKind = 'place' | 'school' | 'event' | 'institution';

/** Live kind vocabulary today verified against `public-seed.ts`'s `PublicEntityKind` union and
 * the four seed entities that exercise it (`kind: 'place' | 'school' | 'event' | 'institution'`). */
export const MAP_KIND_ENCODING: Readonly<Record<MapKind, KindEncodingEntry>> = {
  place: { shade: DIGNITY_PALETTE.kindPlace, glyph: 'circle', label: 'Place' },
  school: { shade: DIGNITY_PALETTE.kindSchool, glyph: 'square', label: 'School' },
  event: { shade: DIGNITY_PALETTE.kindEvent, glyph: 'diamond', label: 'Event' },
  institution: { shade: DIGNITY_PALETTE.kindInstitution, glyph: 'ring', label: 'Institution' },
};

/** Fallback entry for any kind outside the live vocabulary above (defensive; the canonical
 * `@blap/domain` `ENTITY_KINDS` vocabulary is larger than what the active release seeds).
 * Reuses the map's original pre-BB-099 default marker treatment (solid Copper Pin circle), so an
 * unrecognized kind still renders exactly as every kind did before this change never blank,
 * never a crash. */
export const DEFAULT_KIND_ENCODING: KindEncodingEntry = {
  shade: DIGNITY_PALETTE.point,
  glyph: 'circle',
  label: 'Record',
};

const KNOWN_KINDS = Object.keys(MAP_KIND_ENCODING) as readonly MapKind[];

export function isKnownMapKind(kind: string): kind is MapKind {
  return (KNOWN_KINDS as readonly string[]).includes(kind);
}

/** Resolves a feature's `kind` property to its shade + glyph, falling back for any kind not yet
 * in `MAP_KIND_ENCODING` (see this module's doc). */
export function kindEncodingFor(kind: string): KindEncodingEntry {
  return isKnownMapKind(kind) ? MAP_KIND_ENCODING[kind] : DEFAULT_KIND_ENCODING;
}

/** All known entries in a stable order, for building MapLibre `match` expressions and rendering
 * the legend without either place duplicating the kind list by hand. */
export const KIND_ENCODING_ENTRIES: ReadonlyArray<readonly [kind: MapKind, entry: KindEncodingEntry]> =
  KNOWN_KINDS.map((kind) => [kind, MAP_KIND_ENCODING[kind]] as const);
