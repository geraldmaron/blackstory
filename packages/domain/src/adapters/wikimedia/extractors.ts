/**
 * Wikidata identifier, alias, location, and relationship extraction.
 */
import type {
  MediaWikiPage,
  WikidataClaim,
  WikidataEntity,
  WikimediaExternalReference,
  WikimediaLocationHint,
  WikimediaRelationship,
} from './types.js';

const EXTERNAL_ID_PROPERTIES: Readonly<Record<string, string>> = {
  P214: 'VIAF',
  P244: 'LCCN',
  P227: 'GND',
  P213: 'ISNI',
  P269: 'IdRef',
  P950: 'BNE',
  P646: 'Freebase',
  P1417: 'Britannica',
  P5019: 'Brockhaus',
};

const LOCATION_PROPERTIES = new Set(['P131', 'P276', 'P937', 'P19', 'P20', 'P159']);

export function extractWikidataId(
  page: MediaWikiPage,
  entity?: WikidataEntity,
): string | undefined {
  if (entity?.id) {
    return entity.id;
  }
  return undefined;
}

export function extractAliases(entity?: WikidataEntity, language = 'en'): readonly string[] {
  if (!entity?.aliases?.[language]) {
    return [];
  }
  return entity.aliases[language].map((entry) => entry.value).filter(Boolean);
}

export function extractLocations(
  entity?: WikidataEntity,
  language = 'en',
): readonly WikimediaLocationHint[] {
  if (!entity?.claims) {
    return [];
  }

  const locations: WikimediaLocationHint[] = [];
  for (const property of LOCATION_PROPERTIES) {
    const claims = entity.claims[property] ?? [];
    for (const claim of claims) {
      const hint = locationHintFromClaim(claim, language);
      if (hint) {
        locations.push(hint);
      }
    }
  }

  const coordinateClaims = entity.claims.P625 ?? [];
  for (const claim of coordinateClaims) {
    const value = claim.mainsnak.datavalue?.value;
    if (
      value &&
      typeof value === 'object' &&
      value.latitude !== undefined &&
      value.longitude !== undefined &&
      !locations.some((entry) => entry.coordinate !== undefined)
    ) {
      locations.push({
        label: 'Coordinate location',
        coordinate: {
          latitude: value.latitude,
          longitude: value.longitude,
        },
      });
    }
  }

  return dedupeLocations(locations);
}

export function extractRelationships(entity?: WikidataEntity): readonly WikimediaRelationship[] {
  if (!entity?.claims) {
    return [];
  }

  const relationships: WikimediaRelationship[] = [];
  for (const [property, claims] of Object.entries(entity.claims)) {
    if (
      EXTERNAL_ID_PROPERTIES[property] ||
      LOCATION_PROPERTIES.has(property) ||
      property === 'P625'
    ) {
      continue;
    }
    for (const claim of claims) {
      const claimValue = claim.mainsnak.datavalue?.value;
      const targetId = claimValue && typeof claimValue === 'object' ? claimValue.id : undefined;
      if (targetId?.startsWith('Q')) {
        relationships.push({
          property,
          targetWikidataId: targetId,
        });
      }
    }
  }
  return relationships;
}

export function extractExternalReferences(
  entity?: WikidataEntity,
): readonly WikimediaExternalReference[] {
  if (!entity?.claims) {
    return [];
  }

  const references: WikimediaExternalReference[] = [];
  for (const [property, system] of Object.entries(EXTERNAL_ID_PROPERTIES)) {
    const claims = entity.claims[property] ?? [];
    for (const claim of claims) {
      const identifier = externalIdentifierFromClaim(claim);
      if (identifier) {
        const url = routeExternalReferenceUrl(system, identifier);
        references.push({
          system,
          identifier,
          wikidataProperty: property,
          ...(url !== undefined ? { url } : {}),
        });
      }
    }
  }

  return references;
}

function externalIdentifierFromClaim(claim: WikidataClaim): string | undefined {
  const value = claim.mainsnak.datavalue?.value;
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (value.id) {
    return value.id;
  }
  if (value.text) {
    return value.text;
  }
  return undefined;
}

function locationHintFromClaim(
  claim: WikidataClaim,
  _language: string,
): WikimediaLocationHint | undefined {
  const value = claim.mainsnak.datavalue?.value;
  if (!value || typeof value === 'string') {
    return undefined;
  }
  if (value.id?.startsWith('Q')) {
    return {
      label: value.id,
      wikidataId: value.id,
    };
  }
  if (value.text) {
    return { label: value.text };
  }
  return undefined;
}

function dedupeLocations(
  locations: readonly WikimediaLocationHint[],
): readonly WikimediaLocationHint[] {
  const seen = new Set<string>();
  const deduped: WikimediaLocationHint[] = [];
  for (const location of locations) {
    const key = `${location.label}:${location.wikidataId ?? ''}:${location.coordinate?.latitude ?? ''}:${location.coordinate?.longitude ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(location);
  }
  return deduped;
}

/** Route external identifiers to canonical resolver URLs where known. */
export function routeExternalReferenceUrl(system: string, identifier: string): string | undefined {
  switch (system) {
    case 'VIAF':
      return `https://viaf.org/viaf/${encodeURIComponent(identifier)}/`;
    case 'LCCN':
      return `https://id.loc.gov/authorities/${encodeURIComponent(identifier)}`;
    case 'GND':
      return `https://d-nb.info/gnd/${encodeURIComponent(identifier)}`;
    case 'ISNI':
      return `https://isni.org/isni/${encodeURIComponent(identifier)}`;
    default:
      return undefined;
  }
}

export function extractPageCategories(page: MediaWikiPage): readonly string[] {
  return (page.categories ?? []).map((category) => category.title);
}

export function buildWikipediaCanonicalUrl(project: string, title: string): string {
  const host = project.includes('.') ? project : `${project}.wikipedia.org`;
  const encodedTitle = title.replace(/ /g, '_');
  return `https://${host}/wiki/${encodeURIComponent(encodedTitle).replace(/%2F/g, '/')}`;
}

export function buildStableIdentifier(project: string, pageId: number): string {
  const normalizedProject = project.replace('.wikipedia.org', '');
  return `wikimedia:${normalizedProject}:page:${pageId}`;
}

export function readLatestRevision(page: MediaWikiPage): {
  revisionId: number;
  revisionTimestamp: string;
} {
  const latest = page.revisions?.[0];
  if (!latest) {
    throw new Error(`MediaWiki page "${page.title}" is missing revision metadata`);
  }
  return {
    revisionId: latest.revid,
    revisionTimestamp: latest.timestamp,
  };
}

export function resolvePageTitle(
  entity: WikidataEntity | undefined,
  page: MediaWikiPage,
  language = 'en',
): string {
  const wikidataLabel = entity?.labels?.[language]?.value;
  return wikidataLabel ?? page.title;
}
