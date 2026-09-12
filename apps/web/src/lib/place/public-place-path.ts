/**
 * Public place addresses. A reader follows `/place/fifteenth-street-presbyterian-church`,
 * never `/entity/ent_…`. Slugs are derived from the published name, not the catalog id.
 *
 * Place resolution for named walks uses the search index (`place-slug.ts`) so any standable
 * release record can hold. Door pin walks (`atlasWalkHref`) hold on the same live rule —
 * `canStandHere` over the record's own kind/summary/locationPrecision, already on hand at every
 * caller — not a fixture allowlist, so a real catalog record never needs to be enumerated by
 * hand to get a walk. `PLACE_PAGE_STAND_IDS` remains as a cross-checked shortcut for the small
 * set of point-get ids `loadHomeFirstPaint` also stands at; it is additive, never required.
 * Collision addresses are `{slug}--{entityId}`.
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

/**
 * Inventions address `/invention/{slug}`, not `/place/{slug}`.
 *
 * An invention is a `work`, not a stand: Latimer's carbon-manufacturing process happens at no
 * coordinate a reader can walk to, and Banneker's clock is the case that keeps that honest. It
 * rode the place family only because `canStandHere` admits anything that is not a person and
 * carries a summary, which is a test for "not a living private person", not a test for "is a
 * place". The slug rule is shared with Place so one published name resolves the same way in
 * either family, and `/place/{slug}` permanently redirects any invention that still holds an
 * indexed place address.
 */
export function inventionHref(displayName: string): string {
  return `/invention/${publicPlaceSlug(displayName)}`;
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
 * Place-page point-gets. Same ids `loadHomeFirstPaint` stands at, each independently
 * fetched and confirmed with `canStandHere` there. Trusting them here too is a shortcut,
 * not the rule: `placePageHolds` below holds for any record whose own kind/summary/
 * locationPrecision passes `canStandHere`, allowlisted or not.
 */
export const PLACE_PAGE_STAND_IDS = [
  'ent_aarlcc_fort_lauderdale_001',
  'nrhp-black-heritage-91000107',
  'nrhp-black-heritage-100001861',
  'ent_dunbar_school_001',
  'ent_15th_st_church_001',
  'ent_greenwood_district_001',
] as const;

export function isPlacePageStandId(entityId: string): boolean {
  return (PLACE_PAGE_STAND_IDS as readonly string[]).includes(entityId);
}

/**
 * True when `/place/{slug}` is an address the place page will hold, decided from whatever
 * the caller already has on hand (never a fetch). `kind`/`summary`/`locationPrecision` are
 * the same fields `canStandHere` judges everywhere else in this record's family
 * (`instrumentRecordHref`, `neighborHref`); a record missing `kind` cannot be judged and does
 * not hold, so an under-described record never gets a walk invented for it.
 */
export function placePageHolds(input: {
  readonly displayName: string;
  readonly kind?: string;
  readonly summary?: string;
  readonly locationPrecision?: string;
  readonly entityId?: string;
}): boolean {
  if (input.entityId !== undefined && isPlacePageStandId(input.entityId)) return true;
  if (input.kind === undefined) return false;
  return canStandHere({
    displayName: input.displayName,
    kind: input.kind,
    summary: input.summary?.trim() ?? '',
    ...(input.locationPrecision !== undefined
      ? { locationPrecision: input.locationPrecision }
      : {}),
  });
}

/**
 * Address a neighbor from the place door. People and statutes go to the named
 * rooms, not a fabricated place page and never `/entity/ent_…` for those kinds.
 * Inventions go to their own family. Standable neighbors keep `/place/{slug}`.
 * Non-standable records with an id open `/entity/{id}` so the constellation never
 * invents a Place that 404s.
 */
export function neighborHref(neighbor: {
  readonly displayName: string;
  readonly kind: string;
  readonly id?: string;
  readonly summary?: string;
}): string {
  if (neighbor.kind === 'person') return '/memorial';
  if (neighbor.kind === 'law' || neighbor.kind === 'case') return '/law';
  if (neighbor.kind === 'invention') return inventionHref(neighbor.displayName);
  if (neighbor.id !== undefined) {
    if (staysOffPublicMap({ displayName: neighbor.displayName })) {
      return `/entity/${neighbor.id}`;
    }
    const summary = neighbor.summary?.trim() ?? '';
    if (
      !canStandHere({
        displayName: neighbor.displayName,
        kind: neighbor.kind,
        summary,
      })
    ) {
      return `/entity/${neighbor.id}`;
    }
  }
  return placeHref(neighbor.displayName);
}

/**
 * Street-level residences stay off the public map. James H. Dillard House is
 * the live sit: Dillard University and Old Dillard High School stay; the house
 * does not, and it never gets a walk.
 */
export function staysOffPublicMap(input: { readonly displayName: string }): boolean {
  return /dillard house/i.test(input.displayName);
}

/** True when a pin href is a holding `/place/` walk, not a shop token or a 404. */
export function isHoldingPlaceHref(href: string): boolean {
  if (!href.startsWith('/place/')) return false;
  return isPublicPlaceSlug(href.slice('/place/'.length));
}

/**
 * Walk from the home map. `/place/{slug}` only when that slug holds on the place
 * page. People, statutes and inventions go to those rooms. Everything else stays on
 * the plate. Never `/entity/…`, and never a slug invented from a catalog id or a
 * published name.
 */
export function atlasWalkHref(input: {
  readonly displayName: string;
  readonly kind?: string;
  readonly entityId?: string;
  readonly summary?: string;
  readonly locationPrecision?: string;
}): string | undefined {
  if (isInternalRecordLabel(input.displayName)) return undefined;
  if (staysOffPublicMap(input)) return undefined;
  if (input.kind === 'person') return '/memorial';
  if (input.kind === 'law' || input.kind === 'case') return '/law';
  // Before the invention family existed this fell through to `placePageHolds`, which is false
  // for every invention, so an invention pin had no walk at all. Its record is the walk.
  if (input.kind === 'invention') return inventionHref(input.displayName);
  if (
    !placePageHolds({
      displayName: input.displayName,
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.locationPrecision !== undefined
        ? { locationPrecision: input.locationPrecision }
        : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
    })
  ) {
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
