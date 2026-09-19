/**
 * Entity detail page for public records.
 *
 * Standable place/school/event/institution records 308 to `/place/{slug}` (collision form when
 * names collide), and inventions to `/invention/{slug}`. People, street-precision residences, and
 * other non-standable records still render here. Door Rest pin walks stay on the stand allowlist;
 * Place itself resolves the wider corpus via the search index.
 *
 * An id that is not in the release is not automatically gone. A miss consults the published
 * absorbed-to-survivor map (`published.release_entity_redirects`, written by
 * `packages/ops-data/scripts/reconcile-absorbed-entities.ts`) and 308s to the survivor's own
 * public address before it 404s. A record that was WITHDRAWN rather than merged has no survivor,
 * carries no redirect row, and still 404s, which is the honest answer for it.
 *
 * The page body is `./EntityRecordRoom`, shared with `/invention/{slug}`: Next lets a route file
 * export only its own known members, so the room cannot live in this file and still be rendered
 * by another family.
 */
import { notFound, permanentRedirect } from 'next/navigation';
import { buildEntityPageMetadata } from '../../../lib/seo/metadata-builders';
import {
  getPublicSearchIndex,
  resolvePublicEntityRedirect,
  resolvePublicEntityView,
} from '../../../lib/public-data/source';
import { canStandHere, isInternalRecordLabel } from '../../../lib/place/public-place-path';
import { publicRecordHref, placeSlugCollisionCounts } from '../../../lib/place/place-slug';
import type { PublicEntityView } from '../../../data/public-seed';
import { EntityRecordRoom } from './EntityRecordRoom';

/**
 * Caches rendered records with hourly revalidation. In-place corrections can remain stale
 * through both this page cache and the release-catalog cache; publication must account for both
 * windows.
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
  // Enumerating every id from the search index here would prerender the whole catalog: under
  // `revalidate` Next honors static params, and on Vercel `DATABASE_URL` *is* present at build
  // time, so a `shouldUseLivePublicProjections()` guard would pass and the build would pull ~4,092
  // entity pages. On-demand rendering reaches the same cached steady state without paying that at
  // build, and it needs no database at build time at all.
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

/**
 * The record's own public address when it has one: standable records use the human
 * `/place/{slug}` form, inventions `/invention/{slug}`, and collisions carry `--{id}`.
 * `undefined` means this record's address IS `/entity/{id}` and it should render here.
 *
 * Shared by the normal render path and the merge-redirect path so an absorbed id lands on the
 * survivor's real address in ONE hop, rather than 308ing to `/entity/{survivor}` and bouncing
 * again.
 */
async function publicAddressOf(entity: PublicEntityView): Promise<string | undefined> {
  if (!canStandHere(entity) || isInternalRecordLabel(entity.displayName)) return undefined;
  let collisions: ReadonlyMap<string, number> | undefined;
  try {
    const index = await getPublicSearchIndex();
    collisions = placeSlugCollisionCounts(index.data);
  } catch {
    collisions = undefined;
  }
  return publicRecordHref(entity, collisions);
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const resolved = await resolvePublicEntityView(id);
  const entity = resolved.data;
  if (!entity) {
    // Merged away, not gone: forward to the survivor. `notFound()` still runs for everything
    // else: a withdrawn record, a typo, an id that never existed.
    const survivorId = await resolvePublicEntityRedirect(id);
    if (survivorId !== undefined) {
      const survivor = await resolvePublicEntityView(survivorId);
      // A survivor that is itself unpublished gets the same honest 404 the absorbed id would
      // have given, rather than 308ing readers onto a dead address. The `/entity/{id}` fallback
      // is for a published survivor that simply has no standable address of its own.
      if (survivor.data) {
        permanentRedirect((await publicAddressOf(survivor.data)) ?? `/entity/${survivorId}`);
      }
    }
    notFound();
  }

  const address = await publicAddressOf(entity);
  if (address !== undefined) {
    permanentRedirect(address);
  }

  return EntityRecordRoom({ entity });
}
