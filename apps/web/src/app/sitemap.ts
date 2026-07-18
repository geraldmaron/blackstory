/**
 * sitemap route prefers the live public entity pool (same source as explore/search)
 * and falls back to the bundled seed snapshot when live projections are unavailable.
 */
import type { MetadataRoute } from 'next';
import { listPublicEntityViews } from '../lib/public-data/source';
import { buildPublicSitemapEntries } from '../lib/seo/sitemap-builders';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: entities } = await listPublicEntityViews();
  const releaseGeneratedAt = entities[0]?.revision.generatedAt;
  return buildPublicSitemapEntries({
    entities: entities.map((entity) => ({
      id: entity.id,
      updatedAt: entity.revision.recordUpdatedAt,
    })),
    ...(releaseGeneratedAt !== undefined ? { releaseGeneratedAt } : {}),
  });
}
