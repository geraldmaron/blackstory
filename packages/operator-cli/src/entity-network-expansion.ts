/**
 * Bounded Wikidata traversal producing private relationship hypotheses.
 * Each edge retains its immediate endpoints and the path that discovered it.
 * Wikidata statements are discovery leads; their underlying evidence needs review.
 */
import { createHash } from 'node:crypto';
import type { RelationshipType } from '@repo/domain';

const WIKIDATA_ENTITY_DATA = (qid: string) =>
  `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
const WIKIDATA_ITEM_URL = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

export type EntityKindForExpansion = 'person' | 'organization' | 'institution' | 'other';

export type ExpansionSeed = {
  /** Canonical entity id, when the seed is already a resolved canonical row. A raw
   * QID-only seed omits this. */
  readonly entityId?: string;
  readonly qid: string;
  readonly kind: EntityKindForExpansion;
  readonly displayName: string;
};

export type ExpansionConfig = {
  /** 1 = direct neighbors of the seed only; 2 = also expand each 1-hop neighbor once. */
  readonly depth: 1 | 2;
  /** Hard cap on total candidates emitted for the whole run, across all hops. */
  readonly maxCandidates: number;
  readonly maxRequests?: number;
};

export const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = { depth: 1, maxCandidates: 50 };

export type WikidataFetcher = (url: string) => Promise<unknown>;

const USER_AGENT =
  'blackstory-entity-network-expansion/0.1 (research staging lane; proposals only)';

const defaultFetcher: WikidataFetcher = async (url) => {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status} ${url}`);
  return response.json();
};

type WikidataClaim = {
  readonly id?: string;
  readonly rank?: string;
  readonly qualifiers?: Readonly<Record<string, unknown>>;
  readonly references?: readonly Readonly<Record<string, unknown>>[];
  readonly mainsnak?: {
    readonly datavalue?: { readonly value?: unknown };
  };
};

type WikidataEntityDoc = {
  readonly entities?: Record<
    string,
    {
      readonly labels?: Record<string, { readonly value?: string }>;
      readonly claims?: Record<string, readonly WikidataClaim[]>;
    }
  >;
};

/** One Wikidata property this engine understands, and how it maps onto the taxonomy. */
type PropertyMapping = {
  readonly propertyId: string;
  readonly relationshipType: RelationshipType;
  /** 'outgoing' = seed <TYPE> neighbor; 'incoming' = neighbor <TYPE> seed. */
  readonly direction: 'outgoing' | 'incoming';
  readonly note?: string;
};

/** Forward claims read directly off the seed's own Wikidata item. */
const PERSON_FORWARD_PROPERTIES: readonly PropertyMapping[] = [
  { propertyId: 'P108', relationshipType: 'employed_by', direction: 'outgoing' },
  {
    propertyId: 'P69',
    relationshipType: 'other',
    direction: 'outgoing',
    note: 'Wikidata P69 means educated at. Preserve that predicate for review; it does not establish membership.',
  },
  { propertyId: 'P463', relationshipType: 'member_of', direction: 'outgoing' },
  {
    propertyId: 'P485',
    relationshipType: 'other',
    direction: 'outgoing',
    note: 'Wikidata P485 identifies the archive holding records; it does not locate the person.',
  },
];

const ORG_FORWARD_PROPERTIES: readonly PropertyMapping[] = [
  { propertyId: 'P112', relationshipType: 'founded', direction: 'incoming' }, // org FOUNDED_BY founder -> founder founded org
  { propertyId: 'P527', relationshipType: 'part_of', direction: 'incoming' }, // part -> whole
];

/** Reverse claims: Wikidata only records these on the neighbor's item, so they're queried via
 * SPARQL rather than read off the seed's own claims. */
type SparqlReverseQuery = {
  readonly property: string;
  readonly relationshipType: RelationshipType;
  readonly direction: 'outgoing' | 'incoming';
  readonly note?: string;
};

const PERSON_REVERSE_QUERIES: readonly SparqlReverseQuery[] = [
  { property: 'P112', relationshipType: 'founded', direction: 'outgoing' }, // seed founded ?org
  {
    property: 'P50',
    relationshipType: 'authored',
    direction: 'outgoing',
    note: 'Wikidata P50 "author" (reverse) — ?work wdt:P50 seed.',
  },
];

export type RelationshipHypothesis = {
  readonly relationshipType: RelationshipType;
  readonly direction: 'outgoing' | 'incoming';
  readonly note?: string;
};

export type ProvenanceHop = {
  readonly sourceQid: string;
  readonly propertyId: string;
  readonly targetQid: string;
  readonly referenceUrl: string;
  readonly statementSubjectQid: string;
  readonly statementObjectQid: string;
  readonly statement: WikidataClaim;
};

export type NetworkCandidate = {
  readonly sourceQid: string;
  readonly sourceLabel: string;
  readonly qid: string;
  readonly label: string;
  readonly hypothesis: RelationshipHypothesis;
  readonly provenance: readonly ProvenanceHop[];
  readonly hop: 1 | 2;
};

function getLabel(doc: WikidataEntityDoc, qid: string): string {
  return doc.entities?.[qid]?.labels?.en?.value ?? qid;
}

function entityIdFromClaim(claim: WikidataClaim): string | undefined {
  if (claim.rank === 'deprecated') return undefined;
  const value = claim.mainsnak?.datavalue?.value;
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string')
    return undefined;
  return /^Q[0-9]+$/u.test(value.id) ? value.id : undefined;
}

function extractYearFromWikidataTimeClaim(
  claims: readonly WikidataClaim[] | undefined,
): number | undefined {
  const usable = (claims ?? []).filter((claim) => claim.rank !== 'deprecated');
  const preferred = usable.filter((claim) => claim.rank === 'preferred');
  const years = (preferred.length ? preferred : usable).map((claim) => {
    const value = claim.mainsnak?.datavalue?.value;
    if (
      !value ||
      typeof value !== 'object' ||
      !('time' in value) ||
      !('precision' in value) ||
      typeof value.time !== 'string' ||
      typeof value.precision !== 'number' ||
      value.precision < 9
    )
      return undefined;
    const match = /^([+-]?\d{4,})-/u.exec(value.time);
    return match ? Number(match[1]) : undefined;
  });
  const year = years[0];
  return year !== undefined && Number.isSafeInteger(year) && years.every((item) => item === year)
    ? year
    : undefined;
}

/** Reads Wikidata P569 (birth) and P570 (death) time claims from an entity claims map. */
export function extractWikidataBirthDeathYears(claims: Record<string, readonly WikidataClaim[]>): {
  birthYear?: number;
  deathYear?: number;
} {
  const birthYear = extractYearFromWikidataTimeClaim(claims.P569);
  const deathYear = extractYearFromWikidataTimeClaim(claims.P570);
  return {
    ...(birthYear !== undefined ? { birthYear } : {}),
    ...(deathYear !== undefined ? { deathYear } : {}),
  };
}

/** Fetches a Wikidata item and extracts P569/P570 birth/death years for person seeds. */
export async function fetchSeedBirthDeathYears(
  qid: string,
  fetcher: WikidataFetcher,
): Promise<{ birthYear?: number; deathYear?: number }> {
  const doc = (await fetcher(WIKIDATA_ENTITY_DATA(qid))) as WikidataEntityDoc;
  const claims = doc.entities?.[qid]?.claims ?? {};
  return extractWikidataBirthDeathYears(claims);
}

export type EntityNetworkExpansionMeta = {
  seedBirthDeathYears?: { birthYear?: number; deathYear?: number };
};

async function fetchLabel(qid: string, fetcher: WikidataFetcher): Promise<string> {
  const doc = (await fetcher(WIKIDATA_ENTITY_DATA(qid))) as WikidataEntityDoc;
  return getLabel(doc, qid);
}

async function expandForwardClaims(
  seedQid: string,
  mappings: readonly PropertyMapping[],
  fetcher: WikidataFetcher,
  hop: 1 | 2,
  seedBirthDeathOut?: { birthYear?: number; deathYear?: number },
  limit = 50,
): Promise<NetworkCandidate[]> {
  const doc = (await fetcher(WIKIDATA_ENTITY_DATA(seedQid))) as WikidataEntityDoc;
  const claims = doc.entities?.[seedQid]?.claims ?? {};
  if (seedBirthDeathOut) {
    const extracted = extractWikidataBirthDeathYears(claims);
    if (extracted.birthYear !== undefined) seedBirthDeathOut.birthYear = extracted.birthYear;
    if (extracted.deathYear !== undefined) seedBirthDeathOut.deathYear = extracted.deathYear;
  }
  const out: NetworkCandidate[] = [];
  for (const mapping of mappings) {
    for (const statement of claims[mapping.propertyId] ?? []) {
      const neighborQid = entityIdFromClaim(statement);
      if (!neighborQid) continue;
      if (out.length >= limit) return out;
      if (neighborQid === seedQid || !/^Q[0-9]+$/u.test(neighborQid)) continue;
      const label = await fetchLabel(neighborQid, fetcher);
      out.push({
        sourceQid: seedQid,
        sourceLabel: getLabel(doc, seedQid),
        qid: neighborQid,
        label,
        hop,
        hypothesis: {
          relationshipType: mapping.relationshipType,
          direction: mapping.direction,
          ...(mapping.note !== undefined ? { note: mapping.note } : {}),
        },
        provenance: [
          {
            sourceQid: seedQid,
            propertyId: mapping.propertyId,
            targetQid: neighborQid,
            referenceUrl: WIKIDATA_ITEM_URL(seedQid),
            statementSubjectQid: seedQid,
            statementObjectQid: neighborQid,
            statement,
          },
        ],
      });
    }
  }
  return out;
}

type SparqlBinding = {
  readonly item?: { readonly value?: string };
  readonly itemLabel?: { readonly value?: string };
};
type SparqlResult = { readonly results?: { readonly bindings?: readonly SparqlBinding[] } };

function sparqlUrl(query: string): string {
  return `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
}

async function expandReverseClaims(
  seedQid: string,
  queries: readonly SparqlReverseQuery[],
  fetcher: WikidataFetcher,
  hop: 1 | 2,
  sourceLabel: string,
  limit = 50,
): Promise<NetworkCandidate[]> {
  const out: NetworkCandidate[] = [];
  for (const q of queries) {
    const query = `SELECT ?item ?itemLabel WHERE { ?item wdt:${q.property} wd:${seedQid} . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT ${limit}`;
    const result = (await fetcher(sparqlUrl(query))) as SparqlResult;
    const bindings = result.results?.bindings ?? [];
    for (const binding of bindings) {
      if (out.length >= limit) return out;
      const uri = binding.item?.value;
      if (!uri) continue;
      const qid = uri.split('/').pop();
      if (!qid || qid === seedQid || !/^Q[0-9]+$/u.test(qid)) continue;
      const document = (await fetcher(WIKIDATA_ENTITY_DATA(qid))) as WikidataEntityDoc;
      for (const statement of document.entities?.[qid]?.claims?.[q.property] ?? []) {
        if (out.length >= limit) return out;
        if (entityIdFromClaim(statement) !== seedQid) continue;
        out.push({
          sourceQid: seedQid,
          sourceLabel,
          qid,
          label: binding.itemLabel?.value ?? qid,
          hop,
          hypothesis: {
            relationshipType: q.relationshipType,
            direction: q.direction,
            ...(q.note !== undefined ? { note: q.note } : {}),
          },
          provenance: [
            {
              sourceQid: seedQid,
              targetQid: qid,
              propertyId: q.property,
              referenceUrl: WIKIDATA_ITEM_URL(qid),
              statementSubjectQid: qid,
              statementObjectQid: seedQid,
              statement,
            },
          ],
        });
      }
    }
  }
  return out;
}

function forwardMappingsFor(kind: EntityKindForExpansion): readonly PropertyMapping[] {
  if (kind === 'person') return PERSON_FORWARD_PROPERTIES;
  if (kind === 'organization' || kind === 'institution') return ORG_FORWARD_PROPERTIES;
  return [];
}

function reverseQueriesFor(kind: EntityKindForExpansion): readonly SparqlReverseQuery[] {
  if (kind === 'person') return PERSON_REVERSE_QUERIES;
  return [];
}

function dedupeCandidates(candidates: readonly NetworkCandidate[]): NetworkCandidate[] {
  const byEdge = new Map<string, NetworkCandidate>();
  for (const candidate of candidates) {
    const key = [
      candidate.sourceQid,
      candidate.qid,
      candidate.hypothesis.relationshipType,
      candidate.hypothesis.direction,
      ...candidate.provenance.map((hop) => JSON.stringify(hop)),
    ].join('|');
    if (!byEdge.has(key)) byEdge.set(key, candidate);
  }
  return [...byEdge.values()];
}

/**
 * Traverse a seed's Wikidata network to `config.depth` hops, capped at `config.maxCandidates`
 * total. Never mutates any store — pure fetch + shape. Caller is responsible for staging the
 * result (see `stageNetworkCandidates`).
 */
export async function expandEntityNetwork(
  seed: ExpansionSeed,
  config: ExpansionConfig = DEFAULT_EXPANSION_CONFIG,
  fetcher: WikidataFetcher = defaultFetcher,
  meta?: EntityNetworkExpansionMeta,
): Promise<NetworkCandidate[]> {
  if (!/^Q[0-9]+$/u.test(seed.qid)) throw new Error('Seed must have a valid Wikidata QID');
  const maxRequests = config.maxRequests ?? 100;
  if (
    ![1, 2].includes(config.depth) ||
    !Number.isSafeInteger(config.maxCandidates) ||
    config.maxCandidates < 1 ||
    config.maxCandidates > 1000 ||
    !Number.isSafeInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > 1000
  ) {
    throw new Error('Expansion requires depth 1-2 and candidate/request limits 1-1000');
  }
  const upstream = fetcher;
  const cache = new Map<string, Promise<unknown>>();
  fetcher = (url) => {
    const cached = cache.get(url);
    if (cached) return cached;
    if (cache.size >= maxRequests) throw new Error('Expansion request budget exhausted');
    const result = upstream(url);
    cache.set(url, result);
    return result;
  };
  const seedBirthDeathOut =
    seed.kind === 'person' ? ({} as { birthYear?: number; deathYear?: number }) : undefined;
  const hop1Forward = await expandForwardClaims(
    seed.qid,
    forwardMappingsFor(seed.kind),
    fetcher,
    1,
    seedBirthDeathOut,
    config.maxCandidates,
  );
  if (meta && seedBirthDeathOut) {
    const hasBirth = seedBirthDeathOut.birthYear !== undefined;
    const hasDeath = seedBirthDeathOut.deathYear !== undefined;
    if (hasBirth || hasDeath) {
      meta.seedBirthDeathYears = {
        ...(hasBirth ? { birthYear: seedBirthDeathOut.birthYear } : {}),
        ...(hasDeath ? { deathYear: seedBirthDeathOut.deathYear } : {}),
      };
    }
  }
  const hop1Reverse =
    hop1Forward.length < config.maxCandidates
      ? await expandReverseClaims(
          seed.qid,
          reverseQueriesFor(seed.kind),
          fetcher,
          1,
          seed.displayName,
          config.maxCandidates - hop1Forward.length,
        )
      : [];
  let all = dedupeCandidates([...hop1Forward, ...hop1Reverse]);

  if (config.depth === 2) {
    const parents = all;
    const hop2Batches: NetworkCandidate[] = [];
    for (const parent of parents) {
      const remaining = config.maxCandidates - all.length - hop2Batches.length;
      if (remaining <= 0) break;
      const forward = await expandForwardClaims(
        parent.qid,
        [...PERSON_FORWARD_PROPERTIES, ...ORG_FORWARD_PROPERTIES],
        fetcher,
        2,
        undefined,
        remaining,
      );
      for (const child of forward) {
        if (child.qid === seed.qid) continue;
        hop2Batches.push({ ...child, provenance: [...parent.provenance, ...child.provenance] });
      }
    }
    all = dedupeCandidates([...all, ...hop2Batches]);
  }

  if (all.length > config.maxCandidates) {
    all = all.slice(0, config.maxCandidates);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Staging (research.landscape_candidates — lane 'wikidata')
// ---------------------------------------------------------------------------

export type LandscapeCandidateRow = {
  readonly id: string;
  readonly run_id: string;
  readonly lane: 'wikidata';
  readonly source_program_id: string;
  readonly source_item_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string;
  readonly canonical_url: string;
  readonly status: 'pending';
  readonly provenance: {
    readonly seed_qid: string;
    readonly seed_entity_id?: string;
    readonly seed_birth_year?: number;
    readonly seed_death_year?: number;
    readonly hops: readonly ProvenanceHop[];
  };
  readonly payload: {
    readonly relationship_type: RelationshipType;
    readonly direction: 'outgoing' | 'incoming';
    readonly hop: 1 | 2;
    readonly note?: string;
    readonly seedBirthYear?: number;
    readonly seedDeathYear?: number;
    readonly sourceQid: string;
    readonly targetQid: string;
  };
  readonly discovered_at: string;
};

export type StagingInserter = (rows: readonly LandscapeCandidateRow[]) => Promise<void>;

/**
 * Shapes traversal output into `research.landscape_candidates` rows (lane='wikidata',
 * status='pending') and hands them to `insert`. Never writes to `canonical.*` — the caller's
 * `insert` is expected to target the staging table only; this function does not know how to reach
 * canonical and has no code path that could.
 */
export async function stageNetworkCandidates(
  seed: ExpansionSeed,
  candidates: readonly NetworkCandidate[],
  runId: string,
  insert: StagingInserter,
  now: () => string = () => new Date().toISOString(),
  seedBirthDeathYears?: { readonly birthYear?: number; readonly deathYear?: number },
): Promise<readonly LandscapeCandidateRow[]> {
  const discoveredAt = now();
  const hasSeedBirth = seedBirthDeathYears?.birthYear !== undefined;
  const hasSeedDeath = seedBirthDeathYears?.deathYear !== undefined;
  const rows: LandscapeCandidateRow[] = candidates.map((c) => ({
    id: `landcand_wikidata_${createHash('sha256')
      .update(JSON.stringify([runId, seed.qid, c.provenance]))
      .digest('hex')}`,
    run_id: runId,
    lane: 'wikidata',
    source_program_id: 'wikidata-network-expansion',
    source_item_id: `${c.sourceQid}:${c.hypothesis.relationshipType}:${c.hypothesis.direction}:${c.qid}`,
    display_name: c.label,
    kind: 'other',
    summary: `${c.hypothesis.direction === 'outgoing' ? c.sourceLabel : c.label} ${c.hypothesis.relationshipType} ${
      c.hypothesis.direction === 'outgoing' ? c.label : c.sourceLabel
    }`,
    canonical_url: WIKIDATA_ITEM_URL(c.qid),
    status: 'pending',
    provenance: {
      seed_qid: seed.qid,
      ...(seed.entityId !== undefined ? { seed_entity_id: seed.entityId } : {}),
      ...(hasSeedBirth ? { seed_birth_year: seedBirthDeathYears!.birthYear } : {}),
      ...(hasSeedDeath ? { seed_death_year: seedBirthDeathYears!.deathYear } : {}),
      hops: c.provenance,
    },
    payload: {
      sourceQid: c.sourceQid,
      targetQid: c.qid,
      relationship_type: c.hypothesis.relationshipType,
      direction: c.hypothesis.direction,
      hop: c.hop,
      ...(c.hypothesis.note !== undefined ? { note: c.hypothesis.note } : {}),
      ...(hasSeedBirth
        ? {
            seedBirthYear: seedBirthDeathYears!.birthYear,
          }
        : {}),
      ...(hasSeedDeath
        ? {
            seedDeathYear: seedBirthDeathYears!.deathYear,
          }
        : {}),
    },
    discovered_at: discoveredAt,
  }));
  await insert(rows);
  return rows;
}
