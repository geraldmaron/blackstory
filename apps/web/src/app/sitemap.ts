/**
 * BB-057 sitemap route — derives URLs from the bundled release snapshot until BB-019
 * projection fetchers supply live active-release catalogs in production.
 */
import type { MetadataRoute } from 'next';
import { listPublicEntities } from '../data/public-seed';
import { buildPublicSitemapEntries } from '../lib/seo/sitemap-builders';

export default function sitemap(): MetadataRoute.Sitemap {
  const entities = listPublicEntities();
  const releaseGeneratedAt = entities[0]?.revision.generatedAt;
  return buildPublicSitemapEntries({
    entities: entities.map((entity) => ({
      id: entity.id,
      updatedAt: entity.revision.recordUpdatedAt,
    })),
    ...(releaseGeneratedAt !== undefined ? { releaseGeneratedAt } : {}),
  });
}
