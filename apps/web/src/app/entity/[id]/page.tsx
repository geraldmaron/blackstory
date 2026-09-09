/**
 * Entity detail page for public records.
 *
 * Standable place/school/event/institution records 308 to `/place/{slug}` (collision form when
 * names collide), and inventions to `/invention/{slug}`. People, street-precision residences, and
 * other non-standable records still render here. Door Rest pin walks stay on the stand allowlist;
 * Place itself resolves the wider corpus via the search index.
 *
 * The page body is `./EntityRecordRoom`, shared with `/invention/{slug}`: Next lets a route file
 * export only its own known members, so the room cannot live in this file and still be rendered
 * by another family.
 */
import { notFound, permanentRedirect } from 'next/navigation';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import { getPublicSearchIndex, resolvePublicEntityView } from '../../../lib/public-data/source';
import { canStandHere, isInternalRecordLabel } from '../../../lib/place/public-place-path';
import { publicRecordHref, placeSlugCollisionCounts } from '../../../lib/place/place-slug';
import { EntityRecordRoom } from './EntityRecordRoom';

/**
 * Incrementally regenerated, not force-dynamic.
 *
 * `force-dynamic` here dated from the era when the catalog was an expensive per-request
 * Postgres pull. Its cost was measured on 2026-08-09: every response carried Next's dynamic
 * `cache-control: private, no-cache, no-store`, which overrides the `s-maxage=3600` rule this
 * route already declares in `next.config.mjs`, so `x-vercel-cache` was MISS on 100% of entity
 * requests and every reader hit a function.
 *
 * `revalidate` keeps the original guarantee intact (nothing renders at build, so a build
 * without `DATABASE_URL` can never bake the Dunbar seed into a page) while letting a rendered
 * page be reused. 3600s matches the Cache-Control this route already advertises; visible
 * staleness for an in-place correction is bounded by that plus the 30m catalog TTL.
 */
export const revalidate = 3600;
export const dynamicParams = true;

type EntityPageProps = {
  readonly params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  // Deliberately empty: prerender nothing, render every id on demand, then let `revalidate`
  // cache it. `dynamicParams = true` is what makes that safe.
  //
  // This used to enumerate every id from the search index, guarded by a
  // `shouldUseLivePublicProjections()` check for builds with no database. That was inert while
  // the route was `force-dynamic` (Next ignores static params for a force-dynamic route). Under
  // `revalidate` it would become live again, and on Vercel `DATABASE_URL` *is* present at build
  // time, so the guard would pass and the build would pull the full catalog and prerender ~4,092
  // entity pages. On-demand rendering reaches the same cached steady state without paying that
  // at build, and keeps the no-database build safe for the same reason it was safe before.
  return [];
}

export async function generateMetadata({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  if (!resolved.data) {
    return { title: 'Record not found' };
  }
  return buildEntityPageMetadata({
    id: resolved.data.id,
    displayName: resolved.data.displayName,
    summary: resolved.data.summary,
    kind: resolved.data.kind,
    ...(resolved.data.primaryImage !== undefined
      ? { imageUrl: resolved.data.primaryImage.url }
      : {}),
  });
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  const entity = resolved.data;
  if (!entity) {
    notFound();
  }

  // Standable records use the human `/place/{slug}` address; inventions `/invention/{slug}`.
  // Collisions carry `--{id}`.
  if (canStandHere(entity) && !isInternalRecordLabel(entity.displayName)) {
    let collisions: ReadonlyMap<string, number> | undefined;
    try {
      const index = await getPublicSearchIndex();
      collisions = placeSlugCollisionCounts(index.data);
    } catch {
      collisions = undefined;
    }
    permanentRedirect(publicRecordHref(entity, collisions));
  }

  return EntityRecordRoom({ entity });
}
