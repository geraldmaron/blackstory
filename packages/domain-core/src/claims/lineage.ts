/**
 * Source lineage: which underlying work a citation traces back to.
 *
 * The confidence engine dedupes supporting evidence by `lineageRootId` so that syndicated
 * copies count once. That defense only works if the id names the WORK. Until now every
 * production caller set it to `new URL(url).hostname`, which gets the answer wrong in both
 * directions: five newspapers carrying one wire story looked like five independent lineages,
 * a patent read on uspto.gov and on patents.google.com looked like two, and `nps.gov` and
 * `www.nps.gov` looked like two more.
 *
 * The model here is:
 *
 *     URL -> host/publisher -> source item -> upstream work -> lineage cluster
 *
 * Resolution order, most specific first:
 *
 *   1. `upstreamWorkId` recorded by the pipeline. Explicit provenance always wins; it is the
 *      only way to know that three unrelated hosts are carrying one wire story, because
 *      nothing in the three URLs says so.
 *   2. A work identifier extractable from the URL itself — a patent number, a DOI, a LOC item
 *      id, a NARA catalog id. These collapse mirrors across hosts, which is the case that
 *      matters most for patent research.
 *   3. Bridge sources (Wikipedia, Wikidata) collapse to one key and are marked `bridge`, so a
 *      caller can honor the standing rule that a bridge may carry a claim and never
 *      corroborates one.
 *   4. Otherwise the issuing authority — the publisher family behind the host.
 *
 * EVERY INFERENCE HERE EITHER LOWERS THE LINEAGE COUNT OR LEAVES IT UNCHANGED. That is
 * deliberate. Step 4 groups two documents from one authority into one lineage rather than
 * treating distinct paths as distinct lineages, because two reports by the same agency are
 * usually the same agency's account of events, not independent corroboration. Splitting them
 * would raise confidence across the whole catalog on an assumption nobody checked. A caller
 * that HAS checked says so with `independentCreation`, which is the only way to split inside
 * an authority — provenance, not a path difference, is what makes two documents independent.
 *
 * Anything resolved at step 3 or 4 carries `inferred: true`, which is what the
 * `host_based_lineage_suspect` deficit reads. Host stays useful metadata; it stops being the
 * answer.
 *
 * `isPatentDocumentUrl` exposes the patent-mirror detection behind step 2 on its own, so a
 * caller that needs "is this a patent document" without a full lineage resolution — the
 * confidence classifier in `@repo/ops-data` is the current one — reuses the same regexes rather
 * than duplicating them.
 */

/**
 * How a lineage key was arrived at, most specific first.
 *
 * Distinct from @repo/domain's `LINEAGE_KINDS` (syndication, republication, derivative,
 * same_capture, translation), which names the RELATIONSHIP between two pieces of evidence.
 * This names how confidently we know which work a single source belongs to. The two meet at
 * `EvidenceLineage.lineageRootId`, which is what `resolveSourceLineage().key` populates.
 */
export const SOURCE_LINEAGE_KINDS = ['work', 'bridge', 'authority'] as const;
export type SourceLineageKind = (typeof SOURCE_LINEAGE_KINDS)[number];

export type SourceLineage = {
  /** The dedupe key. Two sources sharing this are one lineage. */
  readonly key: string;
  readonly kind: SourceLineageKind;
  /** Why this key was chosen, for operator display and audit. */
  readonly basis: string;
  /**
   * A bridge source (Wikipedia, Wikidata) may carry a claim but never corroborates one.
   * Callers counting corroborating lineages must exclude these.
   */
  readonly bridge: boolean;
  /**
   * True when the key was inferred from the host rather than read from a work identifier or
   * recorded provenance. An inferred lineage is a guess that happens to be the conservative
   * one; it is not a finding.
   */
  readonly inferred: boolean;
};

export type SourceLineageInput = {
  readonly url?: string | undefined;
  /**
   * Work identity recorded by the pipeline — a patent number, an archival item id, a wire
   * story id. Set this whenever provenance is known; it is the only way to collapse copies
   * that share no host and no extractable identifier.
   */
  readonly upstreamWorkId?: string | undefined;
  /**
   * Set only when provenance confirms this document was created independently of others from
   * the same authority — two separately authored collections at one archive, not two pages of
   * one report. Requires a stable document id to key on.
   */
  readonly independentCreation?: { readonly documentId: string } | undefined;
};

/**
 * Host families that are one issuing authority under several names.
 *
 * Each entry maps a hostname suffix to the authority that issues its documents. Matching is
 * `hostMatches` (exact or subdomain), never an unanchored pattern, for the reason recorded in
 * tier1-sources.ts: an unanchored expression tested against a URL matches anywhere, and
 * `evil-nps.gov.example.com` is not a subdomain of `nps.gov`.
 *
 * This list only needs entries where the registrable domain gets the authority WRONG — either
 * because one authority publishes under several registrable domains, or because a shared host
 * carries documents from many authorities. Subdomains of one registrable domain
 * (npgallery.nps.gov under nps.gov) already collapse without an entry.
 */
const AUTHORITY_FAMILIES: readonly { readonly suffix: string; readonly authority: string }[] = [
  // The Patent Office reads under several names, and Google's mirror is not an authority at
  // all — a patent resolved by number never reaches this table, but a USPTO page that is not a
  // patent document should still attribute to the Patent Office.
  { suffix: 'uspto.gov', authority: 'us-patent-office' },
  { suffix: 'patentsview.org', authority: 'us-patent-office' },
  // The Library of Congress serves Chronicling America and its tile server under separate
  // names; all three are the Library.
  { suffix: 'loc.gov', authority: 'library-of-congress' },
  { suffix: 'chroniclingamerica.loc.gov', authority: 'library-of-congress' },
  // The Smithsonian publishes under si.edu and americanhistory.si.edu, and its magazine under
  // a separate registrable domain.
  { suffix: 'si.edu', authority: 'smithsonian' },
  { suffix: 'smithsonianmag.com', authority: 'smithsonian' },
  // The National Archives catalog sits on its own registrable domain from the main site.
  { suffix: 'archives.gov', authority: 'national-archives' },
  { suffix: 'docsteach.org', authority: 'national-archives' },
  // The Park Service's gallery and its main site.
  { suffix: 'nps.gov', authority: 'national-park-service' },
  { suffix: 'npgallery.nps.gov', authority: 'national-park-service' },
  { suffix: 'nasa.gov', authority: 'nasa' },
  { suffix: 'ntrs.nasa.gov', authority: 'nasa' },
  { suffix: 'nih.gov', authority: 'us-national-institutes-of-health' },
  { suffix: 'nlm.nih.gov', authority: 'us-national-institutes-of-health' },
];

/** Hosts whose documents are reference bridges: usable to carry a claim, never to corroborate one. */
const BRIDGE_SUFFIXES: readonly string[] = [
  'wikipedia.org',
  'wikidata.org',
  'wikimedia.org',
  'wikisource.org',
  'm.wikipedia.org',
];

/** The single key every bridge source collapses onto, so ten Wikipedia spellings are one lineage. */
export const BRIDGE_LINEAGE_KEY = 'bridge:wikimedia';

function normalizeHostname(url: string): string | undefined {
  try {
    // Trailing dot is the DNS root and is not part of the name for comparison purposes.
    return new URL(url).hostname.toLowerCase().replace(/\.$/u, '');
  } catch {
    return undefined;
  }
}

/** True when `hostname` is exactly `domain` or a subdomain of it. */
function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * The registrable domain, approximated as the last two labels.
 *
 * This is deliberately not a public-suffix-list lookup. Every host this repository cites sits
 * under a single-label TLD (.gov, .edu, .org, .com, .us), where the last two labels are the
 * registrable name. A multi-part suffix such as `.co.uk` would over-collapse to `co.uk`; if one
 * ever appears in the corpus it belongs in AUTHORITY_FAMILIES rather than in a new algorithm.
 */
function registrableDomain(hostname: string): string {
  const labels = hostname.split('.');
  if (labels.length <= 2) return hostname;
  return labels.slice(-2).join('.');
}

function isBridgeHost(hostname: string): boolean {
  return BRIDGE_SUFFIXES.some((suffix) => hostMatches(hostname, suffix));
}

/**
 * A US patent number as it appears in a URL, normalized for comparison.
 *
 * Patent citations arrive as US252386, US-252,386-A, 252386 and 0252386 depending on the host.
 * Leading zeros and the kind code are presentation, not identity: US 252,386 is one document
 * however it was written down. Design patents (D...), reissues (RE...) and plant patents (PP...)
 * keep their letter prefix because it is part of the number.
 */
function normalizePatentNumber(raw: string): string | undefined {
  const cleaned = raw.toUpperCase().replace(/[,\s_-]/gu, '');
  const match = /^(?:US)?(D|RE|PP|X|H|T)?0*(\d{1,9})(?:[A-Z]\d?)?$/u.exec(cleaned);
  if (match === null) return undefined;
  const series = match[1] ?? '';
  const digits = match[2];
  if (digits === undefined || digits.length === 0) return undefined;
  return `${series}${digits}`;
}

/** Registrable-domain suffixes that mirror US patent documents. */
const PATENT_MIRROR_SUFFIXES: readonly string[] = [
  'patents.google.com',
  'uspto.gov',
  'freepatentsonline.com',
  'patentimages.storage.googleapis.com',
  'patentsview.org',
];

function isPatentMirrorHost(hostname: string): boolean {
  return PATENT_MIRROR_SUFFIXES.some((suffix) => hostMatches(hostname, suffix));
}

/** Patent hosts whose URLs carry a resolvable patent number. */
function patentWorkFromUrl(url: URL, hostname: string): string | undefined {
  if (!isPatentMirrorHost(hostname)) return undefined;

  // patents.google.com/patent/US252386A/en  |  patentimages.../US252386.pdf
  const pathMatch = /\/(?:patent|patents)\/([A-Z]{0,2}[A-Z0-9,-]{2,20})/iu.exec(url.pathname);
  const fromPath = pathMatch?.[1];
  // uspto.gov/...?patentNumber=252386  |  ...&docId=US252386
  const fromQuery =
    url.searchParams.get('patentNumber') ??
    url.searchParams.get('patent') ??
    url.searchParams.get('docId') ??
    undefined;
  // patentimages.storage.googleapis.com/pdfs/US252386.pdf
  const fromFile = /\/([A-Z]{2}[A-Z0-9]{2,15})\.pdf$/iu.exec(url.pathname)?.[1];
  // freepatentsonline.com/4723129.html — the number stands alone as the filename, with no
  // /patent/ path segment at all.
  const fromFreePatentsOnlineFile = hostMatches(hostname, 'freepatentsonline.com')
    ? /\/([A-Z]{0,2}[A-Z0-9]{2,15})\.html?$/iu.exec(url.pathname)?.[1]
    : undefined;

  for (const candidate of [fromPath, fromQuery, fromFile, fromFreePatentsOnlineFile]) {
    if (candidate === undefined) continue;
    const normalized = normalizePatentNumber(candidate);
    if (normalized !== undefined) return `work:patent:us:${normalized}`;
  }
  return undefined;
}

/**
 * True when `url` resolves to an individual patent document on a known patent mirror — not the
 * mirror's home page, not a search or listing page, and not an unrelated path on that host.
 *
 * This is what `classifySourceForConfidence` (in `@repo/ops-data`) uses to grade a patent
 * `government_record` wherever it is read. The classification is of the DOCUMENT — a
 * government grant, the same one whichever mirror serves it — not of the mirror. A search page
 * (`patents.google.com/?q=...`) or the mirror's home page carries no resolvable patent number
 * and correctly returns `false` here, the same test `patentWorkFromUrl` already applies to keep
 * such pages out of the lineage system.
 */
export function isPatentDocumentUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/u, '');
  return patentWorkFromUrl(parsed, hostname) !== undefined;
}

/**
 * Work identity readable from the URL itself.
 *
 * Only identifiers that name a DOCUMENT belong here. A search URL, a collection landing page or
 * a dataset index names a place to look, not a work, and must fall through to the authority.
 */
function workIdFromUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/u, '');
  const path = parsed.pathname;

  const patent = patentWorkFromUrl(parsed, hostname);
  if (patent !== undefined) return patent;

  // A DOI is a work identifier wherever it is resolved from.
  const doi = /(10\.\d{4,9}\/[^\s?#]+)/u.exec(parsed.href);
  if (doi?.[1] !== undefined && (hostMatches(hostname, 'doi.org') || path.includes('/10.'))) {
    return `work:doi:${doi[1].toLowerCase()}`;
  }

  // Library of Congress item: loc.gov/item/<id>/
  const locItem = /\/item\/([a-z0-9._-]+)/iu.exec(path);
  if (locItem?.[1] !== undefined && hostMatches(hostname, 'loc.gov')) {
    return `work:loc-item:${locItem[1].toLowerCase()}`;
  }

  // Chronicling America issue page: /lccn/<lccn>/<date>/ed-N/seq-N
  const chronAm = /\/lccn\/([a-z0-9]+)\/([0-9-]+)\/(ed-\d+)\/(seq-\d+)/iu.exec(path);
  if (chronAm !== null && hostMatches(hostname, 'loc.gov')) {
    return `work:chronam:${chronAm[1]}/${chronAm[2]}/${chronAm[3]}/${chronAm[4]}`.toLowerCase();
  }

  // National Archives catalog record: catalog.archives.gov/id/<id>
  const naraId = /\/id\/(\d+)/u.exec(path);
  if (naraId?.[1] !== undefined && hostMatches(hostname, 'archives.gov')) {
    return `work:nara:${naraId[1]}`;
  }

  // Internet Archive item: archive.org/details/<id>
  const iaItem = /\/details\/([a-z0-9._-]+)/iu.exec(path);
  if (iaItem?.[1] !== undefined && hostMatches(hostname, 'archive.org')) {
    return `work:ia:${iaItem[1].toLowerCase()}`;
  }

  return undefined;
}

/** The issuing authority behind a hostname: a named family if one matches, else the registrable domain. */
export function authorityForHost(hostname: string): string {
  const family = AUTHORITY_FAMILIES.find((entry) => hostMatches(hostname, entry.suffix));
  if (family !== undefined) return family.authority;
  return registrableDomain(hostname);
}

/**
 * Resolve a source to the lineage it belongs to.
 *
 * A source with nothing resolvable at all — no URL, no recorded work — is its own lineage keyed
 * on whatever string it had, because collapsing unidentifiable sources together would silently
 * merge unrelated evidence.
 */
export function resolveSourceLineage(input: SourceLineageInput): SourceLineage {
  const recorded = input.upstreamWorkId?.trim();
  if (recorded !== undefined && recorded.length > 0) {
    return {
      key: recorded.startsWith('work:') ? recorded : `work:${recorded}`,
      kind: 'work',
      basis: 'Recorded upstream work provenance',
      bridge: false,
      inferred: false,
    };
  }

  const url = input.url?.trim();
  if (url === undefined || url.length === 0) {
    return {
      key: 'unresolved:no-source',
      kind: 'authority',
      basis: 'No source URL and no recorded work',
      bridge: false,
      inferred: true,
    };
  }

  const workId = workIdFromUrl(url);
  if (workId !== undefined) {
    return {
      key: workId,
      kind: 'work',
      basis: 'Work identifier read from the source URL',
      bridge: false,
      inferred: false,
    };
  }

  const hostname = normalizeHostname(url);
  if (hostname === undefined) {
    // Not a parseable URL. Key on the raw string so two unparseable sources stay distinct.
    return {
      key: `unresolved:${url.toLowerCase()}`,
      kind: 'authority',
      basis: 'Source is not a parseable URL',
      bridge: false,
      inferred: true,
    };
  }

  if (isBridgeHost(hostname)) {
    return {
      key: BRIDGE_LINEAGE_KEY,
      kind: 'bridge',
      basis: 'Reference bridge: may carry a claim, never corroborates one',
      bridge: true,
      inferred: false,
    };
  }

  const authority = authorityForHost(hostname);
  const independent = input.independentCreation;
  if (independent !== undefined && independent.documentId.trim().length > 0) {
    return {
      key: `authority:${authority}#${independent.documentId.trim().toLowerCase()}`,
      kind: 'authority',
      basis: 'Independently created document at a shared authority, confirmed by provenance',
      bridge: false,
      inferred: false,
    };
  }

  return {
    key: `authority:${authority}`,
    kind: 'authority',
    basis: `Issuing authority inferred from host ${hostname}`,
    bridge: false,
    inferred: true,
  };
}

/** Convenience for callers that only need the dedupe key. */
export function sourceLineageKey(input: SourceLineageInput): string {
  return resolveSourceLineage(input).key;
}

/** True when two sources trace to the same underlying work. */
export function isSameLineage(a: SourceLineageInput, b: SourceLineageInput): boolean {
  return sourceLineageKey(a) === sourceLineageKey(b);
}
