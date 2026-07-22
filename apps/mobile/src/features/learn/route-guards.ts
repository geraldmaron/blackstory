/**
 * Route-parameter validation for `/learn/[section]` and `/learn/[section]/[slug]` (MOB-015).
 *
 * A small, self-contained duplicate of the validation shape `apps/mobile/src/app/_lib/
 * route-params.ts` already establishes for `/entity/[id]` (first-of-array on a possibly-repeated
 * param, bounded length, decode-then-check rather than pattern-match-the-raw-string) — kept local
 * rather than imported so this feature stays self-contained within its exclusive ownership
 * (`apps/mobile/src/features/learn/**`), the same "small enough to duplicate" call this bead's
 * brief makes for the citation link-safety check.
 */
import { ALL_SECTIONS, findSectionRow, type LearnMoreSectionRow } from './sections';
import { CONTENT_CATALOG } from './content-catalog';

const MAX_PARAM_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

function firstOf(raw: unknown): unknown {
  return Array.isArray(raw) ? raw[0] : raw;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Validates a `[section]` route param against the known section registry (`sections.ts`). Never
 * returns a raw, un-vetted string — only an actual row from the fixed table, or `undefined`. */
export function parseSectionParam(raw: unknown): LearnMoreSectionRow | undefined {
  const value = firstOf(raw);
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PARAM_LENGTH) return undefined;
  const decoded = safeDecode(value);
  if (decoded === null) return undefined;
  return findSectionRow(decoded.trim());
}

/** Validates a `[slug]` route param: bounded, allowlisted charset, and — critically — must
 * resolve to an actual catalog entry under the given section before it is trusted for a lookup.
 * A malformed/unknown slug returns `undefined` rather than being handed to a catalog query. */
export function parseSlugParam(raw: unknown, row: LearnMoreSectionRow): string | undefined {
  const value = firstOf(raw);
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PARAM_LENGTH) return undefined;
  const decoded = safeDecode(value);
  if (decoded === null) return undefined;
  const trimmed = decoded.trim();
  if (!SLUG_PATTERN.test(trimmed)) return undefined;
  const exists = CONTENT_CATALOG.some((entry) => entry.section === row.catalogSection && entry.page.slug === trimmed);
  return exists ? trimmed : undefined;
}

/** Every known route id, for static-params-style enumeration/tests. */
export const KNOWN_SECTION_ROUTE_IDS: readonly string[] = ALL_SECTIONS.map((row) => row.routeId);
