/**
 * Suggests explore catalog records from free-text input for place-search typeahead.
 * Pure ranking over already-loaded map features — no network; grounded in published data.
 */
import type { ExploreMapFeature } from './build-explore-map-source';

export type CatalogRecordSuggestion = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly lat: number;
  readonly lng: number;
  readonly jurisdictionLabel?: string;
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Returns up to `limit` catalog records whose display name matches the query
 * (exact → prefix → substring), preferring longer shared prefixes then name length.
 */
export function suggestCatalogRecords(
  query: string,
  features: readonly ExploreMapFeature[],
  limit = 6,
): readonly CatalogRecordSuggestion[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  type Ranked = {
    readonly suggestion: CatalogRecordSuggestion;
    readonly tier: number;
    readonly name: string;
  };
  const ranked: Ranked[] = [];

  for (const feature of features) {
    const { entityId, displayName, kind } = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const name = normalize(displayName);
    let tier = 0;
    if (name === q) tier = 100;
    else if (name.startsWith(q)) tier = 90;
    else if (name.includes(q)) tier = 80;
    else continue;

    ranked.push({
      tier,
      name,
      suggestion: {
        entityId,
        displayName,
        kind,
        lat,
        lng,
        ...(feature.properties.stateName
          ? { jurisdictionLabel: feature.properties.stateName }
          : {}),
      },
    });
  }

  ranked.sort(
    (a, b) => b.tier - a.tier || a.name.localeCompare(b.name) || a.suggestion.entityId.localeCompare(b.suggestion.entityId),
  );

  return ranked.slice(0, limit).map((row) => row.suggestion);
}
