/**
 * Public record address resolution: `/place/{slug}`, and `/invention/{slug}` for the one kind
 * that owns a family of its own.
 *
 * Slugs come from the published display name. When two release records share a name,
 * the address is `{slug}--{entityId}` so the page never invents a wrong stand.
 * Door pin walks still use the stand allowlist; this module opens Place and the Explore
 * instrument to the corpus.
 */
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import {
  canStandHere,
  isInternalRecordLabel,
  isPlacePageStandId,
  publicPlaceSlug,
  staysOffPublicMap,
} from './public-place-path';

/** The one kind that addresses a family of its own rather than `/place/{slug}`. */
const INVENTION_KIND = 'invention';

const PLACE_KIND_RANK: Readonly<Record<string, number>> = {
  place: 0,
  school: 1,
  institution: 2,
  organization: 3,
  event: 4,
  site: 5,
  person: 8,
  law: 9,
  case: 9,
};

export type PlaceAddress = {
  readonly base: string;
  readonly entityId?: string;
};

/** Split a public place path segment into base slug and optional entity id. */
export function parsePlaceAddress(slug: string): PlaceAddress {
  const trimmed = slug.trim();
  const sep = trimmed.indexOf('--');
  if (sep > 0 && sep < trimmed.length - 2) {
    const entityId = trimmed.slice(sep + 2);
    if (entityId.length > 0) {
      return { base: trimmed.slice(0, sep), entityId };
    }
  }
  return { base: trimmed };
}

/**
 * True when the path segment is a legal place address (base slug, or disambiguated
 * `{slug}--{entityId}`).
 */
export function isResolvablePlaceSlug(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('ent_') || trimmed.startsWith('ent-')) {
    // Bare catalog ids are never place addresses; disambiguators may contain them after `--`.
    if (!trimmed.includes('--')) return false;
  }
  if (isInternalRecordLabel(trimmed) && !trimmed.includes('--')) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[A-Za-z0-9_-]+)?$/.test(trimmed);
}

/** How many release names collide on a given base slug. */
export function placeSlugCollisionCounts(
  entities: readonly { readonly displayName: string }[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    if (isInternalRecordLabel(entity.displayName)) continue;
    const base = publicPlaceSlug(entity.displayName);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return counts;
}

/**
 * Public place href for one entity. Disambiguates when the caller knows the base slug collides
 * (Records index, sitemap). Point-gets and unique names keep the short form.
 */
export function placeHrefForEntity(
  entity: { readonly id: string; readonly displayName: string },
  collisions?: ReadonlyMap<string, number>,
): string {
  const base = publicPlaceSlug(entity.displayName);
  if ((collisions?.get(base) ?? 1) > 1) {
    return `/place/${base}--${entity.id}`;
  }
  return `/place/${base}`;
}

/**
 * Public invention href for one entity. Same slug and same collision rule as Place, so a name
 * that disambiguates in one family disambiguates identically in the other.
 */
export function inventionHrefForEntity(
  entity: { readonly id: string; readonly displayName: string },
  collisions?: ReadonlyMap<string, number>,
): string {
  const base = publicPlaceSlug(entity.displayName);
  if ((collisions?.get(base) ?? 1) > 1) {
    return `/invention/${base}--${entity.id}`;
  }
  return `/invention/${base}`;
}

/**
 * The public address of a record, chosen by kind. This is the one place that decides which
 * family a published record belongs to, so the Records index, the sitemap and the
 * `/entity/{id}` redirect cannot drift into disagreeing about where a record lives.
 *
 * Collision counts stay shared across families on purpose: `resolvePlaceSlugFromSearchIndex`
 * searches the whole release by slug, so a name that is ambiguous anywhere is disambiguated
 * everywhere rather than resolving to a different record depending on which family asked.
 */
export function publicRecordHref(
  entity: { readonly id: string; readonly displayName: string; readonly kind?: string },
  collisions?: ReadonlyMap<string, number>,
): string {
  if (entity.kind === INVENTION_KIND) {
    return inventionHrefForEntity(entity, collisions);
  }
  return placeHrefForEntity(entity, collisions);
}

/**
 * Explore instrument / search / map pin deep link. Standable records go to Place. Named people open
 * their entity record (the memorial wall is a room, not a substitute for one pin). Statutes go to
 * `/law`, inventions to `/invention`. Door Rest pin walks still use `atlasWalkHref` (stand
 * allowlist) separately.
 */
export function instrumentRecordHref(
  entity: {
    readonly id: string;
    readonly displayName: string;
    readonly kind: string;
    readonly summary?: string;
    readonly locationPrecision?: string;
  },
  collisions?: ReadonlyMap<string, number>,
): string {
  if (isInternalRecordLabel(entity.displayName)) return '';
  if (staysOffPublicMap(entity)) return '';
  if (entity.kind === 'person') return `/entity/${entity.id}`;
  if (entity.kind === 'law' || entity.kind === 'case') return '/law';
  // Ahead of `canStandHere`, which admits an invention only because it is not a person and
  // carries a summary. An invention is a work, not a stand.
  if (entity.kind === INVENTION_KIND) return inventionHrefForEntity(entity, collisions);
  const summary = entity.summary?.trim() || entity.displayName;
  if (
    !canStandHere({
      displayName: entity.displayName,
      kind: entity.kind,
      summary,
      ...(entity.locationPrecision !== undefined
        ? { locationPrecision: entity.locationPrecision }
        : {}),
    })
  ) {
    return `/entity/${entity.id}`;
  }
  return placeHrefForEntity(entity, collisions);
}

function kindRank(kind: string): number {
  return PLACE_KIND_RANK[kind] ?? 6;
}

function comparePlaceCandidates(
  a: { readonly id: string; readonly kind: string },
  b: { readonly id: string; readonly kind: string },
): number {
  const stand = Number(isPlacePageStandId(b.id)) - Number(isPlacePageStandId(a.id));
  if (stand !== 0) return stand;
  const kind = kindRank(a.kind) - kindRank(b.kind);
  if (kind !== 0) return kind;
  return a.id.localeCompare(b.id);
}

/**
 * Resolve a place path segment to a release entity id using the narrow search index.
 * Does not hydrate full records.
 */
export function resolvePlaceSlugFromSearchIndex(
  docs: readonly PublicSearchIndexDoc[],
  slug: string,
): string | undefined {
  if (!isResolvablePlaceSlug(slug)) return undefined;
  const { base, entityId } = parsePlaceAddress(slug);
  if (entityId) {
    return docs.some((doc) => doc.id === entityId) ? entityId : undefined;
  }
  const matches = docs.filter(
    (doc) => !isInternalRecordLabel(doc.displayName) && publicPlaceSlug(doc.displayName) === base,
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0]!.id;
  return [...matches].sort(comparePlaceCandidates)[0]?.id;
}
