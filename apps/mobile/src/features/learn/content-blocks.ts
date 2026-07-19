/**
 * Structured content renderer's INPUT normalizer (MOB-015).
 *
 * Turns an `unknown` value (a freshly-fetched JSON body, a bundled catalog entry, or a value read
 * back out of the offline cache) into a small, ALLOWLISTED list of `NormalizedBlock`s the
 * presentational renderer (`ContentRenderer.tsx`) can render without ever branching on untrusted
 * shape again.
 *
 * The real wire contract (`ContentPageV1`, content-types.ts) has exactly two body-level
 * primitives: an optional section `heading` and a `paragraphs` array of strings. There is no
 * tagged block-type union in production — so "reject an unrecognized block type" here means:
 * reject/skip any `body[]` element that is not a plain object shaped like `{heading?: string,
 * paragraphs: string[]}`. This module does not invent table/media/callout block types; it
 * degrades anything that doesn't match the two known shapes into a skip, never a crash and never
 * a raw passthrough render of arbitrary structure (which would be the "arbitrary HTML renderer"
 * anti-pattern this bead explicitly forbids).
 *
 * Hard bounds mirror (but do not import, see content-types.ts) `packages/public-contracts`'s
 * `boundedArray`/`nonEmptyText` bounds so a maliciously large payload cannot force unbounded
 * allocation or render work on-device.
 */
import type { ContentPageV1, ContentSectionV1 } from './content-types';

export const MAX_BODY_SECTIONS = 200;
export const MAX_PARAGRAPHS_PER_SECTION = 200;
export const MAX_PARAGRAPH_CHARS = 10_000;
export const MAX_HEADING_CHARS = 300;
export const MAX_RELATED_IDS = 200;
/** Related-id lists are rendered through a bounded/virtualized list (RelatedList.tsx); this is
 * the hard render cap even if an upstream payload's own array bound (200, matching
 * `boundedArray`) were somehow exceeded — belt-and-suspenders against a huge/tampered table. */
export const MAX_RELATED_IDS_RENDERED = 500;

export type NormalizedBlock =
  | { readonly kind: 'heading'; readonly text: string; readonly level: 1 | 2 }
  | { readonly kind: 'paragraph'; readonly text: string };

export interface NormalizeResult {
  readonly page: NormalizedPage | null;
  readonly blocks: readonly NormalizedBlock[];
  /** Count of body[] elements that did not match the allowlisted section shape and were
   * skipped — surfaced so the UI can show an honest "N items skipped" fallback instead of
   * silently pretending the page was rendered in full. */
  readonly skippedSections: number;
}

export interface NormalizedPage {
  readonly slug: string;
  readonly title: string;
  readonly dek: string;
  readonly publishedAt: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

/**
 * Validates one `body[]` element structurally WITHOUT ever recursing into unexpected shape: a
 * hostile "deeply nested" payload (e.g. `{ paragraphs: [{ paragraphs: [{ paragraphs: [...] }] }] }`
 * or a self-referential-looking object standing in for a paragraph) fails the `typeof x ===
 * 'string'` check on its very first element and is dropped in O(1) — this function never walks
 * into a nested object looking for "maybe a paragraph is in here somewhere". That is the
 * stack-safety property the adversarial "deep nesting" test asserts on.
 */
function normalizeSection(raw: unknown): ContentSectionV1 | null {
  if (!isPlainObject(raw)) return null;
  if (!Array.isArray(raw.paragraphs)) return null;
  if (raw.heading !== undefined && !isBoundedString(raw.heading, MAX_HEADING_CHARS)) return null;

  const paragraphs: string[] = [];
  for (const item of raw.paragraphs.slice(0, MAX_PARAGRAPHS_PER_SECTION)) {
    if (!isNonEmptyBoundedString(item, MAX_PARAGRAPH_CHARS)) continue; // skip malformed entry, don't abort the page
    paragraphs.push(item);
  }
  if (paragraphs.length === 0) return null; // an empty-paragraph section carries nothing to render

  return raw.heading !== undefined ? { heading: raw.heading, paragraphs } : { paragraphs };
}

function normalizeIdArray(raw: unknown, max: number): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw.slice(0, max)) {
    if (isNonEmptyBoundedString(item, 200)) out.push(item);
  }
  return out;
}

/**
 * Normalizes a raw, untrusted value into the page-level fields plus a flat, ordered list of
 * renderable blocks. Never throws; anything that doesn't fit the allowlisted shape is dropped,
 * never rendered as-is.
 */
export function normalizeContentPage(raw: unknown): NormalizeResult {
  if (!isPlainObject(raw)) return { page: null, blocks: [], skippedSections: 0 };

  const slug = isNonEmptyBoundedString(raw.slug, 200) ? raw.slug : null;
  const title = isNonEmptyBoundedString(raw.title, 300) ? raw.title : null;
  if (slug === null || title === null) return { page: null, blocks: [], skippedSections: 0 };

  const dek = isBoundedString(raw.dek, 1000) ? raw.dek : '';
  const publishedAt = isBoundedString(raw.publishedAt, 64) ? raw.publishedAt : '';
  const eraLabel = isBoundedString(raw.eraLabel, 100) ? raw.eraLabel : '';
  const placeLabel = isBoundedString(raw.placeLabel, 200) ? raw.placeLabel : '';

  const bodyRaw = Array.isArray(raw.body) ? raw.body.slice(0, MAX_BODY_SECTIONS) : [];
  const blocks: NormalizedBlock[] = [];
  let skippedSections = 0;
  for (const sectionRaw of bodyRaw) {
    const section = normalizeSection(sectionRaw);
    if (section === null) {
      skippedSections++;
      continue;
    }
    if (section.heading) {
      blocks.push({ kind: 'heading', text: section.heading, level: 2 });
    }
    for (const paragraph of section.paragraphs) {
      blocks.push({ kind: 'paragraph', text: paragraph });
    }
  }
  if (Array.isArray(raw.body) && raw.body.length > MAX_BODY_SECTIONS) {
    skippedSections += raw.body.length - MAX_BODY_SECTIONS;
  }

  const page: NormalizedPage = {
    slug,
    title,
    dek,
    publishedAt,
    eraLabel,
    placeLabel,
    relatedEntityIds: normalizeIdArray(raw.relatedEntityIds, MAX_RELATED_IDS),
    relatedFactIds: normalizeIdArray(raw.relatedFactIds, MAX_RELATED_IDS),
  };

  return { page, blocks, skippedSections };
}

/** Convenience wrapper for already-typed, trusted `ContentPageV1` values (bundled catalog data) —
 * still runs through the same normalizer so catalog bugs are caught by the same defenses a
 * hostile network payload would be. */
export function normalizeTypedContentPage(page: ContentPageV1): NormalizeResult {
  return normalizeContentPage(page as unknown);
}
