/**
 * Wikidata authority-anchor reconciliation for bb_canonical.entities.
 *
 * Resolves a canonical entity (name + kind + optional disambiguator) to a Wikidata QID via the
 * `wbsearchentities` API, then pulls LCNAF (P244), SNAC ARK (P3430), and FAST (P2163) identifiers
 * from the resolved item's claims. Property IDs were verified against a known entity (Audre
 * Lorde, Q463319) before use — see repo-xez5.3.
 *
 * Same rule as `packages/domain/src/graph/mention-resolver.ts`: never guess. A candidate is only
 * auto-accepted when it is the unique, unambiguous, type-compatible match. Anything else is
 * queued for human review rather than linked.
 */

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

export type EntityKind =
  | 'person'
  | 'place'
  | 'event'
  | 'institution'
  | 'school'
  | 'organization'
  | 'case'
  | 'law'
  | 'publication'
  | 'movement'
  | 'other';

export type ReconciliationInput = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: EntityKind;
  /** Free-text disambiguator, e.g. an era or notability note, used only to break ties. */
  readonly disambiguator?: string;
};

export type WikidataCandidate = {
  readonly qid: string;
  readonly label: string;
  readonly description?: string;
};

export type IdentifierHit = {
  readonly namespace: 'lcnaf' | 'snac_ark' | 'fast';
  readonly value: string;
};

export type ReconciliationResult =
  | {
      readonly status: 'matched';
      readonly entityId: string;
      readonly qid: string;
      readonly identifiers: readonly IdentifierHit[];
    }
  | {
      readonly status: 'no_match';
      readonly entityId: string;
      readonly note: string;
    }
  | {
      readonly status: 'ambiguous';
      readonly entityId: string;
      readonly candidates: readonly WikidataCandidate[];
      readonly note: string;
    };

/** Wikidata property IDs verified against Q463319 (Audre Lorde) on 2026-07-24. */
export const WIKIDATA_PROPERTY_MAP: Record<IdentifierHit['namespace'], string> = {
  lcnaf: 'P244',
  snac_ark: 'P3430',
  fast: 'P2163',
};

/**
 * Negative/conflict signals per entity kind: a unique exact-name match is rejected only when the
 * Wikidata description clearly signals an incompatible type (e.g. an org name resolving to a
 * human, or vice versa). Absence of a conflict is treated as compatible (permissive default),
 * since museums/libraries/archives/theaters/schools/etc. all read as "institution" but carry very
 * varied Wikidata descriptions that a positive allow-list would keep missing.
 */
const KIND_CONFLICTS: Record<EntityKind, readonly string[]> = {
  person: [
    'museum', 'university', 'college', 'newspaper', 'magazine', 'organization', 'company',
    'building', 'river', 'mountain', 'song', 'film', 'album', 'novel', 'church', 'school',
    'tram stop', 'train station', 'metro station', 'railway station', 'street', 'square', 'park',
    'painting', 'sculpture', 'artwork', 'portrait', 'photograph', 'statue', 'library', 'archive',
    'presidency of', 'administration', 'series in the national archives',
  ],
  place: ['human', 'given name', 'surname'],
  event: ['human', 'given name', 'surname'],
  institution: ['human', 'given name', 'surname', 'river', 'mountain', 'song', 'film', 'album', 'novel'],
  school: ['human', 'given name', 'surname', 'river', 'mountain'],
  organization: ['human', 'given name', 'surname', 'river', 'mountain', 'song', 'film', 'album', 'novel'],
  case: ['human', 'given name', 'surname'],
  law: ['human', 'given name', 'surname'],
  publication: ['human', 'given name', 'surname', 'organization', 'museum', 'university', 'river', 'mountain'],
  movement: ['human', 'given name', 'surname'],
  other: [],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function descriptionLooksCompatible(kind: EntityKind, description: string | undefined): boolean {
  if (!description) return true; // absence of a description is not a conflict signal
  const conflicts = KIND_CONFLICTS[kind];
  if (conflicts.length === 0) return true;
  const normalizedDesc = normalize(description);
  return !conflicts.some((conflict) => normalizedDesc.includes(normalize(conflict)));
}

export type WikidataFetcher = (url: string) => Promise<unknown>;

const defaultFetcher: WikidataFetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikidata request failed: ${res.status} ${url}`);
  return res.json();
};

export async function searchWikidata(
  name: string,
  fetcher: WikidataFetcher = defaultFetcher,
): Promise<WikidataCandidate[]> {
  const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(
    name,
  )}&language=en&format=json&type=item&limit=6`;
  const data = (await fetcher(url)) as {
    search?: Array<{ id: string; label?: string; display?: { label?: { value?: string } }; description?: string }>;
  };
  return (data.search ?? []).map((entry) => ({
    qid: entry.id,
    label: entry.display?.label?.value ?? entry.label ?? '',
    ...(entry.description !== undefined ? { description: entry.description } : {}),
  }));
}

export async function fetchWikidataIdentifiers(
  qid: string,
  fetcher: WikidataFetcher = defaultFetcher,
): Promise<IdentifierHit[]> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const data = (await fetcher(url)) as {
    entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }>;
  };
  const claims = data.entities?.[qid]?.claims ?? {};
  const hits: IdentifierHit[] = [];
  for (const [namespace, propertyId] of Object.entries(WIKIDATA_PROPERTY_MAP) as Array<
    [IdentifierHit['namespace'], string]
  >) {
    const claim = claims[propertyId];
    if (!claim || claim.length === 0) continue;
    const value = claim[0]?.mainsnak?.datavalue?.value;
    if (typeof value === 'string' && value.trim().length > 0) {
      hits.push({ namespace, value: value.trim() });
    }
  }
  return hits;
}

/**
 * Core matching rule (never guess):
 *  - Exact normalized label match + description compatible with kind + exactly one such
 *    candidate among the results => high-confidence auto-accept.
 *  - Zero candidates at all => no_match.
 *  - More than one exact-label, type-compatible candidate, or only fuzzy/alias matches => ambiguous,
 *    queued for human review, never linked.
 */
export function classifyCandidates(
  input: ReconciliationInput,
  candidates: readonly WikidataCandidate[],
): { decision: 'accept'; candidate: WikidataCandidate } | { decision: 'no_match' } | { decision: 'ambiguous' } {
  if (candidates.length === 0) return { decision: 'no_match' };

  const targetName = normalize(input.displayName);
  const exactCompatible = candidates.filter(
    (c) => normalize(c.label) === targetName && descriptionLooksCompatible(input.kind, c.description),
  );

  const [onlyExactCompatible] = exactCompatible;
  if (exactCompatible.length === 1 && onlyExactCompatible) {
    return { decision: 'accept', candidate: onlyExactCompatible };
  }
  if (exactCompatible.length > 1) {
    // Try to break the tie with the disambiguator (era/notability text), else stay ambiguous.
    if (input.disambiguator) {
      const disambig = normalize(input.disambiguator);
      const narrowed = exactCompatible.filter(
        (c) => c.description && disambig.includes(normalize(c.description)),
      );
      const [onlyNarrowed] = narrowed;
      if (narrowed.length === 1 && onlyNarrowed) {
        return { decision: 'accept', candidate: onlyNarrowed };
      }
    }
    return { decision: 'ambiguous' };
  }

  // No exact+compatible match: alias/fuzzy-only hits are never auto-accepted.
  return { decision: 'ambiguous' };
}

export async function reconcileEntity(
  input: ReconciliationInput,
  fetcher: WikidataFetcher = defaultFetcher,
): Promise<ReconciliationResult> {
  const candidates = await searchWikidata(input.displayName, fetcher);
  const classification = classifyCandidates(input, candidates);

  if (classification.decision === 'no_match') {
    return {
      status: 'no_match',
      entityId: input.entityId,
      note: `No Wikidata candidates returned for "${input.displayName}".`,
    };
  }

  if (classification.decision === 'ambiguous') {
    return {
      status: 'ambiguous',
      entityId: input.entityId,
      candidates,
      note:
        candidates.length > 0
          ? `${candidates.length} candidate(s), none uniquely exact+type-compatible for "${input.displayName}" (${input.kind}).`
          : `No unambiguous candidate for "${input.displayName}".`,
    };
  }

  const identifiers = await fetchWikidataIdentifiers(classification.candidate.qid, fetcher);
  return {
    status: 'matched',
    entityId: input.entityId,
    qid: classification.candidate.qid,
    identifiers,
  };
}
