/**
 * Match discovery/enrichment titles against the national catalog so operators
 * enrich existing entities instead of recreating them. Classifies leads as
 * existing_match | new_candidate | non_entity (lists/indexes/guides).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type CatalogEntityRef = {
  readonly id: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly kind?: string;
};

export type CatalogMatchIndex = {
  readonly entities: readonly CatalogEntityRef[];
  /** Lowercased normalized name/alias → entity ids (may be multi if collisions). */
  readonly byNormalizedName: ReadonlyMap<string, readonly string[]>;
};

export type LeadClassificationKind = 'existing_match' | 'new_candidate' | 'non_entity';

export type LeadClassification = {
  readonly kind: LeadClassificationKind;
  readonly title: string;
  readonly coreName: string;
  readonly matchedEntityId?: string;
  readonly matchedDisplayName?: string;
  readonly matchMethod?: 'exact' | 'alias' | 'contains' | 'known_map';
  readonly reason: string;
  readonly enrichmentHint?: string;
};

const NON_ENTITY_TITLE =
  /\b(list of|site index|resource guide|digital (resources|collections)|related resources|searching the|about this collection|teaching with|grades?\s+\d|auto tour|ten important|named in honor|from hidden to modern|black history in nps|400 years|inventors & stem|african americans in business|civil war era black washington|gladstone collection|records of the bureau|freedmen'?s bureau digital|long black freedom|featured places|wikidata:)\b/i;

const NON_ENTITY_TITLE_EXACT =
  /^(african american heritage(\s|\(|$)|african-american history and culture$|boston'?s?\s+[""]?black women lead)/i;

const TITLE_SUFFIX =
  /\s*([|\-–—:]|\bWikipedia\b|\bNASA\+?\b|\bNational Park Service\b|\bU\.S\. National.*|\bSmithsonian.*|\bLibrary of Congress\b).*$/i;

/** High-frequency Corsair collisions → canonical catalog ids. */
const KNOWN_TITLE_TO_ENTITY: ReadonlyArray<{ readonly pattern: RegExp; readonly entityId: string }> = [
  { pattern: /\bkatherine(\s+g\.?)?\s+johnson\b/i, entityId: 'ent_katherine_johnson_001' },
  { pattern: /\bbirthplace of a hidden figure\b/i, entityId: 'ent_katherine_johnson_001' },
  { pattern: /\bmary(\s+w\.?)?\s+jackson\b/i, entityId: 'ent_mary_jackson_001' },
  { pattern: /\bdorothy\s+vaughan\b/i, entityId: 'ent_dorothy_vaughan_001' },
  { pattern: /\bchristine(\s+m\.?)?\s+darden\b/i, entityId: 'ent_christine_darden_001' },
  { pattern: /\bmarjorie(\s+stewart|\s+s\.?)?\s+joyner\b/i, entityId: 'ent_marjorie_joyner_001' },
  { pattern: /\bellen(\s+f\.?)?\s+eglin\b/i, entityId: 'ent_ellen_eglin_001' },
  { pattern: /\bcarter\s+g\.?\s+woodson\b/i, entityId: 'ent_carter_g_woodson_001' },
  { pattern: /\bgreenwood(\s+district)?\b|\bblack wall street\b/i, entityId: 'ent_greenwood_district_001' },
  { pattern: /\btuskegee(\s+institute|\s+university)?\b/i, entityId: 'ent_tuskegee_university_001' },
  { pattern: /\bfort monroe\b/i, entityId: 'ent_fort_monroe_001' },
  { pattern: /\bmadam\s+c\.?\s*j\.?\s+walker\b/i, entityId: 'ent_madam_cj_walker_001' },
  { pattern: /\bbooker\s+t\.?\s+washington\b/i, entityId: 'ent_tuskegee_university_001' },
];

export function normalizePersonOrPlaceName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(TITLE_SUFFIX, '')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function coreNameFromTitle(title: string): string {
  const stripped = title.replace(TITLE_SUFFIX, '').replace(/\s+/g, ' ').trim();
  return stripped.length > 0 ? stripped : title.trim();
}

function looksLikeNonEntity(title: string, summary?: string): boolean {
  const blob = `${title}\n${summary ?? ''}`;
  if (NON_ENTITY_TITLE.test(title) || NON_ENTITY_TITLE_EXACT.test(title.trim())) return true;
  if (/^visit\s*-/i.test(title.trim()) || /^people\s*-/i.test(title.trim())) return true;
  if (/\b(resource guide|site index|digital collection|finding aid)\b/i.test(blob)) return true;
  return false;
}

export function buildCatalogMatchIndex(entities: readonly CatalogEntityRef[]): CatalogMatchIndex {
  const byNormalizedName = new Map<string, string[]>();
  for (const entity of entities) {
    const keys = new Set<string>([
      normalizePersonOrPlaceName(entity.displayName),
      ...entity.aliases.map((alias) => normalizePersonOrPlaceName(alias)),
    ]);
    for (const key of keys) {
      if (!key) continue;
      const list = byNormalizedName.get(key) ?? [];
      if (!list.includes(entity.id)) list.push(entity.id);
      byNormalizedName.set(key, list);
    }
  }
  return { entities, byNormalizedName };
}

type FixtureEntity = {
  readonly id?: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
  readonly kind?: string;
};

export function loadCatalogEntitiesFromFixtures(catalogDir: string): CatalogEntityRef[] {
  if (!existsSync(catalogDir)) return [];
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  const out: CatalogEntityRef[] = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as unknown;
    const ents = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { entities?: unknown }).entities)
        ? ((raw as { entities: FixtureEntity[] }).entities)
        : [];
    for (const entry of ents) {
      if (!entry || typeof entry !== 'object') continue;
      const id = typeof entry.id === 'string' ? entry.id : undefined;
      const displayName = typeof entry.displayName === 'string' ? entry.displayName : undefined;
      if (!id || !displayName) continue;
      out.push({
        id,
        displayName,
        aliases: Array.isArray(entry.aliases)
          ? entry.aliases.filter((a): a is string => typeof a === 'string')
          : [],
        ...(typeof entry.kind === 'string' ? { kind: entry.kind } : {}),
      });
    }
  }
  return out;
}

function resolveEntity(
  index: CatalogMatchIndex,
  entityId: string,
): CatalogEntityRef | undefined {
  return index.entities.find((entity) => entity.id === entityId);
}

/**
 * Classify a discovery/enrichment title against the catalog.
 * Prefer enriching `existing_match` over authoring a new fixture.
 */
export function classifyLeadAgainstCatalog(input: {
  readonly title: string;
  readonly summary?: string;
  readonly index: CatalogMatchIndex;
}): LeadClassification {
  const title = input.title.trim();
  const coreName = coreNameFromTitle(title);
  const normalized = normalizePersonOrPlaceName(coreName);

  if (looksLikeNonEntity(title, input.summary)) {
    return {
      kind: 'non_entity',
      title,
      coreName,
      reason: 'Title/summary looks like a list, index, guide, tour, or collection landing page — not a catalog entity.',
    };
  }

  for (const known of KNOWN_TITLE_TO_ENTITY) {
    if (known.pattern.test(title) || known.pattern.test(coreName)) {
      const entity = resolveEntity(input.index, known.entityId);
      if (entity) {
        return {
          kind: 'existing_match',
          title,
          coreName,
          matchedEntityId: entity.id,
          matchedDisplayName: entity.displayName,
          matchMethod: 'known_map',
          reason: `Known catalog collision → ${entity.id}`,
          enrichmentHint: `Enrich ${entity.id} (${entity.displayName}) with new claims/sources from this lead; do not create a duplicate entity.`,
        };
      }
    }
  }

  const exactIds = input.index.byNormalizedName.get(normalized) ?? [];
  if (exactIds.length === 1) {
    const entity = resolveEntity(input.index, exactIds[0]!);
    if (entity) {
      return {
        kind: 'existing_match',
        title,
        coreName,
        matchedEntityId: entity.id,
        matchedDisplayName: entity.displayName,
        matchMethod: 'exact',
        reason: `Exact name/alias match → ${entity.id}`,
        enrichmentHint: `Enrich ${entity.id} (${entity.displayName}); skip new fixture.`,
      };
    }
  }

  // Unique contains: catalog name contained in core, or core contained in catalog name (min length).
  if (normalized.length >= 8) {
    const containsHits: string[] = [];
    for (const [key, ids] of input.index.byNormalizedName) {
      if (key.length < 8) continue;
      if (normalized.includes(key) || key.includes(normalized)) {
        for (const id of ids) {
          if (!containsHits.includes(id)) containsHits.push(id);
        }
      }
    }
    if (containsHits.length === 1) {
      const entity = resolveEntity(input.index, containsHits[0]!);
      if (entity) {
        return {
          kind: 'existing_match',
          title,
          coreName,
          matchedEntityId: entity.id,
          matchedDisplayName: entity.displayName,
          matchMethod: 'contains',
          reason: `Unique substring match → ${entity.id}`,
          enrichmentHint: `Likely duplicate of ${entity.id}; enrich existing or open related-entity leads only.`,
        };
      }
    }
  }

  return {
    kind: 'new_candidate',
    title,
    coreName,
    reason: 'No catalog name/alias/known-map hit — candidate for new entity after human validation.',
  };
}
