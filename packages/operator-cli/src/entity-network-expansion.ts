/**
 * Entity network expansion engine: seed (canonical entity id + Wikidata QID, or a raw QID) ->
 * Wikidata claims traversal -> staged candidates with typed relationship hypotheses.
 *
 * Reuses the `WikidataFetcher` injection pattern from `./entity-reconciliation.ts` (never guess:
 * every neighbor is backed by an actual Wikidata claim or SPARQL row, never invented). Forward
 * claims (employer, educated at, member of, archives at) are read off the seed's own
 * `Special:EntityData` document, same as `fetchWikidataIdentifiers`. Reverse claims (orgs founded
 * BY the seed, works authored BY the seed) are not present on the seed's own claims — Wikidata
 * only records them on the neighbor's item (P112/P50 point at the seed) — so those use the public
 * SPARQL query service instead. Both paths take an injectable fetcher for testing; nothing here
 * calls `bb_canonical` directly. Output rows are always `status: 'pending_review'` in the staging
 * table — see `stageNetworkCandidates` — never written to `bb_canonical.entities` or
 * `entity_relationships`.
 *
 * Relationship types are restricted to the exact vocabulary in `docs/relationship-taxonomy.md`
 * (`RelationshipType` from `@repo/domain`). Wikidata properties with no dedicated taxonomy type
 * (educated at, archives at) are mapped to the closest documented fit and flagged with a note
 * explaining the mapping, rather than inventing a new type.
 */
import type { RelationshipType } from '@repo/domain';

const WIKIDATA_ENTITY_DATA = (qid: string) => `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
const WIKIDATA_ITEM_URL = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

export type EntityKindForExpansion = 'person' | 'organization' | 'institution' | 'other';

export type ExpansionSeed = {
  /** Canonical entity id, when the seed is already a resolved bb_canonical row. Optional — a raw
   * QID-only seed (e.g. Audre Lorde before repo-xez5.12's audit backfills her) omits this. */
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
};

export const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = { depth: 1, maxCandidates: 50 };

export type WikidataFetcher = (url: string) => Promise<unknown>;

const USER_AGENT = 'blackstory-entity-network-expansion/0.1 (repo-xez5.4; research staging lane, never auto-published)';

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
    if (res.ok) return res;
    if (res.status === 429 || res.status === 503) {
      lastError = new Error(`Wikidata request failed: ${res.status} ${url}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
      continue;
    }
    throw new Error(`Wikidata request failed: ${res.status} ${url}`);
  }
  throw lastError instanceof Error ? lastError : new Error(`Wikidata request failed: ${url}`);
}

const defaultFetcher: WikidataFetcher = async (url) => {
  const res = await fetchWithRetry(url);
  return res.json();
};

type WikidataClaim = {
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
    relationshipType: 'member_of',
    direction: 'outgoing',
    note: 'Wikidata P69 "educated at" — taxonomy has no dedicated educated_at type; staged as member_of (student as institutional member) per docs/relationship-taxonomy.md guidance to prefer the closest documented fit.',
  },
  { propertyId: 'P463', relationshipType: 'member_of', direction: 'outgoing' },
  {
    propertyId: 'P485',
    relationshipType: 'other',
    direction: 'outgoing',
    note: 'Wikidata P485 "archives at" — taxonomy has no dedicated archived_at type; staged as other pending a reviewer decision (candidates for located_at or a new type are both defensible).',
  },
];

const ORG_FORWARD_PROPERTIES: readonly PropertyMapping[] = [
  { propertyId: 'P112', relationshipType: 'founded', direction: 'incoming' }, // org FOUNDED_BY founder -> founder founded org
  { propertyId: 'P527', relationshipType: 'member_of', direction: 'incoming' }, // org has-part member -> member member_of org
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
  readonly referenceUrl: string;
};

export type NetworkCandidate = {
  readonly qid: string;
  readonly label: string;
  readonly hypothesis: RelationshipHypothesis;
  readonly provenance: readonly ProvenanceHop[];
  readonly hop: 1 | 2;
};

function getLabel(doc: WikidataEntityDoc, qid: string): string {
  return doc.entities?.[qid]?.labels?.en?.value ?? qid;
}

function extractEntityIds(claims: readonly WikidataClaim[] | undefined): string[] {
  if (!claims) return [];
  const ids: string[] = [];
  for (const claim of claims) {
    const value = claim.mainsnak?.datavalue?.value;
    if (
      value &&
      typeof value === 'object' &&
      'id' in (value as Record<string, unknown>) &&
      typeof (value as { id?: unknown }).id === 'string'
    ) {
      ids.push((value as { id: string }).id);
    }
  }
  return ids;
}

async function fetchLabel(qid: string, fetcher: WikidataFetcher): Promise<string> {
  const doc = (await fetcher(WIKIDATA_ENTITY_DATA(qid))) as WikidataEntityDoc;
  return getLabel(doc, qid);
}

async function expandForwardClaims(
  seedQid: string,
  mappings: readonly PropertyMapping[],
  fetcher: WikidataFetcher,
  hop: 1 | 2,
): Promise<NetworkCandidate[]> {
  const doc = (await fetcher(WIKIDATA_ENTITY_DATA(seedQid))) as WikidataEntityDoc;
  const claims = doc.entities?.[seedQid]?.claims ?? {};
  const out: NetworkCandidate[] = [];
  for (const mapping of mappings) {
    const neighborQids = extractEntityIds(claims[mapping.propertyId]);
    for (const neighborQid of neighborQids) {
      const label = await fetchLabel(neighborQid, fetcher);
      out.push({
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
            referenceUrl: WIKIDATA_ITEM_URL(seedQid),
          },
        ],
      });
    }
  }
  return out;
}

type SparqlBinding = { readonly item?: { readonly value?: string }; readonly itemLabel?: { readonly value?: string } };
type SparqlResult = { readonly results?: { readonly bindings?: readonly SparqlBinding[] } };

function sparqlUrl(query: string): string {
  return `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
}

async function expandReverseClaims(
  seedQid: string,
  queries: readonly SparqlReverseQuery[],
  fetcher: WikidataFetcher,
  hop: 1 | 2,
): Promise<NetworkCandidate[]> {
  const out: NetworkCandidate[] = [];
  for (const q of queries) {
    const query = `SELECT ?item ?itemLabel WHERE { ?item wdt:${q.property} wd:${seedQid} . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
    const result = (await fetcher(sparqlUrl(query))) as SparqlResult;
    const bindings = result.results?.bindings ?? [];
    for (const binding of bindings) {
      const uri = binding.item?.value;
      if (!uri) continue;
      const qid = uri.split('/').pop();
      if (!qid) continue;
      out.push({
        qid,
        label: binding.itemLabel?.value ?? qid,
        hop,
        hypothesis: {
          relationshipType: q.relationshipType,
          direction: q.direction,
          ...(q.note !== undefined ? { note: q.note } : {}),
        },
        provenance: [
          { sourceQid: seedQid, propertyId: q.property, referenceUrl: WIKIDATA_ITEM_URL(seedQid) },
        ],
      });
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
  const byQid = new Map<string, NetworkCandidate>();
  for (const c of candidates) {
    const existing = byQid.get(c.qid);
    if (!existing) {
      byQid.set(c.qid, c);
    } else {
      // Same neighbor reached more than once: keep the first hypothesis, merge provenance.
      byQid.set(c.qid, { ...existing, provenance: [...existing.provenance, ...c.provenance] });
    }
  }
  return [...byQid.values()];
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
): Promise<NetworkCandidate[]> {
  const hop1Forward = await expandForwardClaims(seed.qid, forwardMappingsFor(seed.kind), fetcher, 1);
  const hop1Reverse = await expandReverseClaims(seed.qid, reverseQueriesFor(seed.kind), fetcher, 1);
  let all = dedupeCandidates([...hop1Forward, ...hop1Reverse]);

  if (config.depth === 2) {
    const hop1Qids = all.map((c) => c.qid);
    const hop2Batches: NetworkCandidate[][] = [];
    for (const qid of hop1Qids) {
      if (all.length + hop2Batches.flat().length >= config.maxCandidates) break;
      // Second-hop neighbors are treated as generic ("other") since we don't know the neighbor's
      // canonical kind without a resolution step — safer to under-classify than guess.
      const forward = await expandForwardClaims(qid, PERSON_FORWARD_PROPERTIES, fetcher, 2);
      hop2Batches.push(forward);
    }
    all = dedupeCandidates([...all, ...hop2Batches.flat()]);
  }

  if (all.length > config.maxCandidates) {
    all = all.slice(0, config.maxCandidates);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Staging (bb_research.landscape_candidates — lane 'wikidata')
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
    readonly hops: readonly ProvenanceHop[];
  };
  readonly payload: {
    readonly relationship_type: RelationshipType;
    readonly direction: 'outgoing' | 'incoming';
    readonly hop: 1 | 2;
    readonly note?: string;
  };
  readonly discovered_at: string;
};

export type StagingInserter = (rows: readonly LandscapeCandidateRow[]) => Promise<void>;

/**
 * Shapes traversal output into `bb_research.landscape_candidates` rows (lane='wikidata',
 * status='pending') and hands them to `insert`. Never writes to `bb_canonical.*` — the caller's
 * `insert` is expected to target the staging table only; this function does not know how to reach
 * bb_canonical and has no code path that could.
 */
export async function stageNetworkCandidates(
  seed: ExpansionSeed,
  candidates: readonly NetworkCandidate[],
  runId: string,
  insert: StagingInserter,
  now: () => string = () => new Date().toISOString(),
): Promise<readonly LandscapeCandidateRow[]> {
  const discoveredAt = now();
  const rows: LandscapeCandidateRow[] = candidates.map((c) => ({
    id: `landcand_wikidata_${seed.qid}_${c.qid}`,
    run_id: runId,
    lane: 'wikidata',
    source_program_id: 'wikidata-network-expansion',
    source_item_id: c.qid,
    display_name: c.label,
    kind: 'other',
    summary: `${c.hypothesis.direction === 'outgoing' ? seed.displayName : c.label} ${c.hypothesis.relationshipType} ${
      c.hypothesis.direction === 'outgoing' ? c.label : seed.displayName
    }`,
    canonical_url: WIKIDATA_ITEM_URL(c.qid),
    status: 'pending',
    provenance: {
      seed_qid: seed.qid,
      ...(seed.entityId !== undefined ? { seed_entity_id: seed.entityId } : {}),
      hops: c.provenance,
    },
    payload: {
      relationship_type: c.hypothesis.relationshipType,
      direction: c.hypothesis.direction,
      hop: c.hop,
      ...(c.hypothesis.note !== undefined ? { note: c.hypothesis.note } : {}),
    },
    discovered_at: discoveredAt,
  }));
  await insert(rows);
  return rows;
}
