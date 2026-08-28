/**
 * Public place addresses. A reader follows `/place/fifteenth-street-presbyterian-church`,
 * never `/entity/ent_…`. Slugs are derived from the published name, not the catalog id.
 */

const TULSA_PLACE = /tulsa|greenwood|black wall street/i;

/**
 * Opaque catalog tokens must never title a place or appear in a public address.
 * `42Cb1758` and `ent_*` stay inside the archive.
 */
export function isInternalRecordLabel(value: string | undefined): boolean {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (/^(ent|disc|art|pkg|rec|src)_/i.test(trimmed)) return true;
  return (
    !/\s/.test(trimmed) &&
    /^[A-Za-z0-9_-]{6,32}$/.test(trimmed) &&
    /\d/.test(trimmed) &&
    /[A-Za-z]/.test(trimmed)
  );
}

export function publicPlaceSlug(displayName: string): string {
  const slug = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'place';
}

export function placeHref(displayName: string): string {
  return `/place/${publicPlaceSlug(displayName)}`;
}

/** Cookie set when a reader stands at a named place. `/` reads it as last stand. */
export const STAND_COOKIE = 'bs-stand';

export function isPublicPlaceSlug(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('ent_') || trimmed.startsWith('ent-')) return false;
  if (isInternalRecordLabel(trimmed)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed);
}

/**
 * Address a neighbor from the place door. People and statutes go to the named
 * rooms, not a fabricated place page and never `/entity/ent_…`.
 */
export function neighborHref(neighbor: {
  readonly displayName: string;
  readonly kind: string;
}): string {
  if (neighbor.kind === 'person') return '/memorial';
  if (neighbor.kind === 'law' || neighbor.kind === 'case') return '/law';
  return placeHref(neighbor.displayName);
}

export function isTulsaPlace(input: {
  readonly displayName: string;
  readonly jurisdictionLabel?: string;
  readonly locationLabel?: string;
}): boolean {
  return TULSA_PLACE.test(
    [input.displayName, input.jurisdictionLabel ?? '', input.locationLabel ?? ''].join(' '),
  );
}

/** Public stand: a published place/school/institution/event, never a living private person. */
export function canStandHere(input: {
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  readonly locationPrecision?: string;
}): boolean {
  if (isInternalRecordLabel(input.displayName)) return false;
  if (input.kind === 'person') return false;
  if (input.summary.trim().length === 0) return false;
  if (input.locationPrecision === 'street' || input.locationPrecision === 'address') return false;
  return true;
}
