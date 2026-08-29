/**
 * Public place addresses. A reader follows `/place/fifteenth-street-presbyterian-church`,
 * never `/entity/ent_…`. Slugs are derived from the published name, not the catalog id.
 *
 * A `/place/{slug}` walk is only emitted when that slug actually resolves on the place
 * page (`loadHomeFirstPaint({ namedSlug, requireNamed: true })`). That lookup is the
 * stand-candidate ids plus the bundled seed names that can stand. Slugifying a published
 * catalog name is not enough, and invents a 404.
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

/** Cookie set when a reader stands at a named place. Rooms no longer print that name as the site back. */
export const STAND_COOKIE = 'bs-stand';

export function isPublicPlaceSlug(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('ent_') || trimmed.startsWith('ent-')) return false;
  if (isInternalRecordLabel(trimmed)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed);
}

/**
 * Place-page point-gets. Same ids `loadHomeFirstPaint` stands at. A live catalog
 * name is not a holding slug unless it is one of these records.
 */
export const PLACE_PAGE_STAND_IDS = [
  'ent_aarlcc_fort_lauderdale_001',
  'nrhp-black-heritage-91000107',
  'nrhp-black-heritage-100001861',
  'ent_dunbar_school_001',
  'ent_15th_st_church_001',
  'ent_greenwood_district_001',
] as const;

/**
 * Slugs the place page resolves via its seed path (`seedBySlug`). Keep in lockstep
 * with `listPublicEntities()` ∩ `canStandHere` — tested, not invented.
 */
export const SEED_HOLDING_PLACE_SLUGS = [
  'fifteenth-street-presbyterian-church',
  'paul-laurence-dunbar-high-school',
  'd-c-inventory-of-historic-sites-listing-1975',
  'dunbar-alumni-federation',
] as const;

export function isPlacePageStandId(entityId: string): boolean {
  return (PLACE_PAGE_STAND_IDS as readonly string[]).includes(entityId);
}

/** True when `/place/{slug}` is an address the place page will hold. */
export function placePageHolds(input: {
  readonly displayName: string;
  readonly entityId?: string;
}): boolean {
  if (input.entityId !== undefined && isPlacePageStandId(input.entityId)) return true;
  return (SEED_HOLDING_PLACE_SLUGS as readonly string[]).includes(
    publicPlaceSlug(input.displayName),
  );
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

/**
 * Walk from the home map. `/place/{slug}` only when that slug holds on the place
 * page. People and statutes go to those rooms. Everything else stays on the plate.
 * Never `/entity/…`, and never a slug invented from a catalog id or a published name.
 */
export function atlasWalkHref(input: {
  readonly displayName: string;
  readonly kind?: string;
  readonly entityId?: string;
}): string | undefined {
  if (isInternalRecordLabel(input.displayName)) return undefined;
  if (input.kind === 'person') return '/memorial';
  if (input.kind === 'law' || input.kind === 'case') return '/law';
  if (!placePageHolds({ displayName: input.displayName, entityId: input.entityId })) {
    return undefined;
  }
  return placeHref(input.displayName);
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
