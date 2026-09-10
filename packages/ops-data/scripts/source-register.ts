/**
 * Tool that produces and re-verifies `scripts/lib/source-register.json` against external
 * authority registries, so that recognizing an institution stops being a person typing a
 * hostname into a source file.
 *
 * The rule the tool enforces is stated once, in `scripts/lib/source-register.ts`. In short: a
 * host is registered only when some Wikidata item names THAT HOST as its own official website
 * (P856), carries at least one library or research authority identifier (LCNAF, VIAF, ISNI,
 * ROR, GRID or the IMLS Museum Universe Data File id), and is an instance of — or of a subclass
 * of — one of the institution classes on the allowlist. Anything short of all three is a
 * `review` for a person, never an automatic accept.
 *
 * HOW IT FINDS THE ITEM
 *
 * Two stages, because the obvious query does not work. A regular expression over every P856
 * value in Wikidata is a full index scan and times out at the query service's 60-second ceiling
 * (measured, 2026-09-10). So:
 *
 *   1. Probe exact IRIs. An institution's P856 is nearly always its bare homepage, so eight
 *      spellings per host (http/https, with and without `www.`, with and without a trailing
 *      slash) as a VALUES clause is an index lookup — the whole curated list answers in under a
 *      second.
 *   2. For hosts stage 1 misses, ask the wiki's own search for candidate items mentioning the
 *      host, then check each candidate's real P856 value here. Search is a candidate generator
 *      only; it never decides anything. A host that search surfaces but whose P856 does not
 *      match is not registered.
 *
 * Every network call goes through the DNS-pinned safe-fetch path (`lib/safe-fetch.ts`), never
 * a bare `fetch()`, and SPARQL calls are paced at least a second apart with a user agent that
 * names the tool, per Wikimedia's user-agent policy.
 *
 * USAGE (from the repo root)
 *
 *   node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
 *     propose --from-list --out /tmp/proposals.json
 *   node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
 *     propose --hosts poets.org,nypl.org --out /tmp/proposals.json
 *   node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
 *     apply --file /tmp/proposals.json --reviewed-by "Name (context, date)"
 *   node --conditions development --import tsx packages/ops-data/scripts/source-register.ts \
 *     verify --older-than 180
 *
 * `verify` exits non-zero when anything drifted, so a run before a publish pass fails loudly. It never
 * deletes an entry: a host that stops answering for an afternoon is not the same event as a
 * host that has been sold, and only a person can tell those apart.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeFetchIsReachable, safeFetchJson } from './lib/safe-fetch.ts';
import {
  AUTHORITY_ID_PROPERTIES,
  loadSourceRegister,
  ORG_TYPE_SOURCE_CLASS,
  sourceRegisterPath,
  WIKIDATA_CLASS_ALLOWLIST,
  type AuthorityIdKey,
  type SourceRegisterEntry,
  type SourceRegisterFile,
  type SourceRegisterOrgType,
} from './lib/source-register.ts';
import { REPUTABLE_SECONDARY_HOST_SUFFIXES } from './lib/tier1-sources.ts';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/**
 * Wikimedia asks every automated client to name itself and leave a route to a human. The repo
 * is that route; an operator running this from somewhere else can override it.
 */
export const SOURCE_REGISTER_USER_AGENT =
  process.env.SOURCE_REGISTER_USER_AGENT ??
  'blackstory-source-register/1.0 (+https://github.com/geraldmaron/blackstory)';

/** Wikimedia's pacing floor for scripted query-service traffic. */
const SPARQL_PACE_MS = 1_000;

/** Hosts per exact-IRI probe. Eight IRIs each, kept well inside a safe GET URL length. */
const PROBE_BATCH_SIZE = 15;

/** Candidate items pulled from wiki search per host before their P856 values are checked. */
const SEARCH_CANDIDATE_LIMIT = 10;

/**
 * Which organization type wins when an item is an instance of several allowlisted classes.
 *
 * Most specific first, and `government_agency` deliberately sits BELOW the collecting
 * institutions. A state archive that is also formally a state agency grades as an archive
 * (reputable_secondary, 0.75) rather than a government record (0.95): understating a real
 * institution's authority costs a claim some score, overstating it puts a 0.95 behind something
 * that is not a federal or state record. `cultural_institution` is last of the institutions
 * because almost every one of them is also one of those.
 */
const ORG_TYPE_PRECEDENCE: readonly SourceRegisterOrgType[] = [
  'museum',
  'archive',
  'library',
  'historical_society',
  'learned_society',
  'encyclopedia',
  'university',
  'research_institute',
  'hall_of_fame',
  'public_broadcaster',
  'government_agency',
  'cultural_institution',
  'cemetery',
  'news_publisher',
];

export type JsonFetcher = (url: string) => Promise<unknown>;

export type WikidataCandidate = {
  readonly qid: string;
  readonly label: string;
  readonly description?: string;
  readonly officialWebsites: readonly string[];
  readonly instanceOf: readonly string[];
  readonly authorityIds: Partial<Record<AuthorityIdKey, string>>;
};

export type ProposedEntry = Omit<SourceRegisterEntry, 'reviewedBy' | 'reviewedAt' | 'verifiedAt'>;

export type Proposal = {
  readonly host: string;
  readonly verdict: 'accept' | 'review' | 'reject';
  readonly reasons: readonly string[];
  readonly entry?: ProposedEntry;
  readonly candidates: readonly WikidataCandidate[];
};

export type ProposalFile = {
  readonly checkedAt: string;
  readonly proposals: readonly Proposal[];
};

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

/**
 * The eight spellings an institution's homepage plausibly takes as a P856 value.
 *
 * Deliberately not a pattern: these go into a VALUES clause, which is an index probe. A pattern
 * would be a scan of every official-website statement in Wikidata, which does not finish.
 */
/**
 * Does this official-website value actually say "this host is mine"?
 *
 * Two conditions, both learned from a real bad accept on the first migration run (2026-09-10).
 *
 * The value must be a SITE ROOT. Wikidata items for small Texas towns carry P856 values pointing
 * at their Handbook of Texas article — `http://www.tshaonline.org/handbook/online/articles/hja10`
 * — and the town of Anton has an LCNAF record and is a city, which closes to government agency.
 * Without this check the tool proposed registering the entire Texas State Historical Association
 * domain as a GOVERNMENT RECORD on the authority of a town's article link. A deep link says
 * "this page is about me", which is not the same claim.
 *
 * And the value's host must be the host itself or its `www.` form, not any subdomain of it.
 * Otherwise one museum's page on a shared platform (`museum.emuseum.com`) would register the
 * whole platform.
 */
export function websiteAuthorizesHost(website: string, host: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(website);
  } catch {
    return false;
  }
  if (parsed.pathname !== '' && parsed.pathname !== '/') return false;
  const websiteHost = parsed.hostname.toLowerCase().replace(/\.$/u, '');
  const target = host.toLowerCase().replace(/\.$/u, '');
  return websiteHost === target || websiteHost === `www.${target}`;
}

/** True when the host sits under a government top-level domain. */
export function isGovernmentTldHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/u, '');
  return normalized.endsWith('.gov') || normalized.endsWith('.mil');
}

export function candidateWebsiteIris(host: string): readonly string[] {
  const iris: string[] = [];
  for (const scheme of ['https', 'http']) {
    for (const prefix of ['', 'www.']) {
      for (const trailing of ['', '/']) {
        iris.push(`${scheme}://${prefix}${host}${trailing}`);
      }
    }
  }
  return iris;
}

export function buildOfficialWebsiteProbeQuery(hosts: readonly string[]): string {
  const values = hosts.flatMap((host) => candidateWebsiteIris(host).map((iri) => `<${iri}>`));
  // p:/ps: rather than wdt:, so a non-preferred official-website statement still counts. An
  // institution that moved domains often keeps the old value at normal rank and the new one as
  // preferred; both are things it said about itself.
  return `SELECT ?item ?website WHERE { VALUES ?website { ${values.join(' ')} } ?item p:P856/ps:P856 ?website . }`;
}

export function buildItemFactsQuery(qids: readonly string[]): string {
  const values = qids.map((qid) => `wd:${qid}`).join(' ');
  const optionalIds = Object.entries(AUTHORITY_ID_PROPERTIES)
    .map(([property, key]) => `OPTIONAL { ?item wdt:${property} ?${key} }`)
    .join('\n  ');
  return `SELECT ?item ?itemLabel ?itemDescription ?website ?p31 ${Object.values(
    AUTHORITY_ID_PROPERTIES,
  )
    .map((key) => `?${key}`)
    .join(' ')} WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item p:P856/ps:P856 ?website }
  OPTIONAL { ?item wdt:P31 ?p31 }
  ${optionalIds}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

export function buildClassClosureQuery(classQids: readonly string[]): string {
  const values = classQids.map((qid) => `wd:${qid}`).join(' ');
  const roots = Object.keys(WIKIDATA_CLASS_ALLOWLIST)
    .map((qid) => `wd:${qid}`)
    .join(' ');
  // P279* is what makes the allowlist scale: "state historical society of Minnesota" never has
  // to be typed anywhere, it is a subclass of historical society.
  return `SELECT ?cls ?root WHERE { VALUES ?cls { ${values} } VALUES ?root { ${roots} } ?cls wdt:P279* ?root . }`;
}

type SparqlBinding = Readonly<Record<string, { readonly value: string } | undefined>>;
type SparqlResponse = { readonly results: { readonly bindings: readonly SparqlBinding[] } };

export function sparqlBindings(payload: unknown): readonly SparqlBinding[] {
  const response = payload as SparqlResponse | undefined;
  return response?.results?.bindings ?? [];
}

function qidFromUri(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

/** Folds the row-per-value SPARQL result for a batch of items into one record per item. */
export function collectCandidates(
  bindings: readonly SparqlBinding[],
): ReadonlyMap<string, WikidataCandidate> {
  const websites = new Map<string, Set<string>>();
  const classes = new Map<string, Set<string>>();
  const labels = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const ids = new Map<string, Record<string, string>>();
  for (const binding of bindings) {
    const itemUri = binding.item?.value;
    if (itemUri === undefined) continue;
    const qid = qidFromUri(itemUri);
    if (binding.website?.value)
      (websites.get(qid) ?? setIn(websites, qid)).add(binding.website.value);
    if (binding.p31?.value)
      (classes.get(qid) ?? setIn(classes, qid)).add(qidFromUri(binding.p31.value));
    if (binding.itemLabel?.value) labels.set(qid, binding.itemLabel.value);
    if (binding.itemDescription?.value) descriptions.set(qid, binding.itemDescription.value);
    for (const key of Object.values(AUTHORITY_ID_PROPERTIES)) {
      const value = binding[key]?.value;
      if (!value) continue;
      const bucket = ids.get(qid) ?? {};
      // First value wins: several rows repeat the same id, and an item with two VIAF clusters
      // has a data problem we are not here to resolve.
      bucket[key] ??= value;
      ids.set(qid, bucket);
    }
  }
  const result = new Map<string, WikidataCandidate>();
  for (const qid of new Set([...websites.keys(), ...classes.keys(), ...labels.keys()])) {
    const description = descriptions.get(qid);
    result.set(qid, {
      qid,
      label: labels.get(qid) ?? qid,
      ...(description === undefined ? {} : { description }),
      officialWebsites: [...(websites.get(qid) ?? [])].sort(),
      instanceOf: [...(classes.get(qid) ?? [])].sort(),
      authorityIds: (ids.get(qid) ?? {}) as Partial<Record<AuthorityIdKey, string>>,
    });
  }
  return result;
}

function setIn(map: Map<string, Set<string>>, key: string): Set<string> {
  const created = new Set<string>();
  map.set(key, created);
  return created;
}

/** The organization type an item's P31 values earn, given a resolved subclass closure. */
export function orgTypeForClasses(
  instanceOf: readonly string[],
  closure: ReadonlyMap<string, readonly string[]>,
): SourceRegisterOrgType | undefined {
  const types = new Set<SourceRegisterOrgType>();
  for (const cls of instanceOf) {
    for (const root of closure.get(cls) ?? []) {
      const orgType = WIKIDATA_CLASS_ALLOWLIST[root];
      if (orgType) types.add(orgType);
    }
  }
  return ORG_TYPE_PRECEDENCE.find((orgType) => types.has(orgType));
}

function authorityIdCount(candidate: WikidataCandidate): number {
  return Object.values(candidate.authorityIds).filter(Boolean).length;
}

function describeCandidate(candidate: WikidataCandidate): string {
  return `${candidate.qid} (${candidate.label})`;
}

/**
 * The whole acceptance rule, in one place and with no network in it.
 *
 * `accept` needs every condition at once. Everything else is a `review` that names which
 * condition failed, or a `reject` when nothing in Wikidata claims the host at all.
 */
export function verdictForHost(
  host: string,
  candidates: readonly WikidataCandidate[],
  closure: ReadonlyMap<string, readonly string[]>,
): Proposal {
  if (isGovernmentTldHost(host)) {
    // Not a gap in the register — a host that does not need one. `.gov` and `.mil` are already
    // government_record from the TLD, before the register is consulted, so an entry here could
    // only ever LOWER the host: the Maryland State Archives is an `archive` in Wikidata's terms,
    // which is reputable_secondary, which is worse than what msa.maryland.gov already gets.
    return {
      host,
      verdict: 'reject',
      reasons: [
        `${host} is under a government TLD and already classifies as government_record; a register entry could only lower it`,
      ],
      candidates,
    };
  }
  const claiming = candidates.filter((candidate) =>
    candidate.officialWebsites.some((website) => websiteAuthorizesHost(website, host)),
  );
  if (claiming.length === 0) {
    return {
      host,
      verdict: 'reject',
      reasons: [
        candidates.length === 0
          ? 'no Wikidata item names this host as its official website (P856)'
          : `no candidate item's official website is the root of ${host}; checked ${candidates
              .map(describeCandidate)
              .join(', ')}`,
      ],
      candidates,
    };
  }

  type Assessed = {
    readonly candidate: WikidataCandidate;
    readonly orgType: SourceRegisterOrgType | undefined;
    readonly idCount: number;
  };
  type Qualified = Assessed & { readonly orgType: SourceRegisterOrgType };
  const assessed: readonly Assessed[] = claiming.map((candidate) => ({
    candidate,
    orgType: orgTypeForClasses(candidate.instanceOf, closure),
    idCount: authorityIdCount(candidate),
  }));
  const qualified = assessed.filter(
    (row): row is Qualified => row.orgType !== undefined && row.idCount > 0,
  );

  if (qualified.length === 0) {
    const reasons = assessed.map((row) => {
      const missing: string[] = [];
      if (row.orgType === undefined) {
        missing.push(
          row.candidate.instanceOf.length === 0
            ? 'has no instance-of (P31) at all'
            : `instance-of ${row.candidate.instanceOf.join(', ')} does not reach an allowlisted institution class`,
        );
      }
      if (row.idCount === 0) {
        missing.push('carries no authority identifier (LCNAF/VIAF/ISNI/ROR/GRID/IMLS)');
      }
      return `${describeCandidate(row.candidate)} ${missing.join('; ')}`;
    });
    return { host, verdict: 'review', reasons, candidates };
  }

  const classes = new Set(qualified.map((row) => ORG_TYPE_SOURCE_CLASS[row.orgType]));
  if (classes.size > 1) {
    return {
      host,
      verdict: 'review',
      reasons: [
        `two or more items claim ${host} and they disagree about what it is: ${qualified
          .map((row) => `${describeCandidate(row.candidate)} -> ${row.orgType}`)
          .join(', ')}`,
      ],
      candidates,
    };
  }

  // Same source class either way, so picking between them cannot change the score. Most
  // authority identifiers wins, then lowest Q-number, so a re-run produces the same entry.
  const ranked = [...qualified].sort(
    (left, right) =>
      right.idCount - left.idCount ||
      Number(left.candidate.qid.slice(1)) - Number(right.candidate.qid.slice(1)),
  );
  const chosen = ranked[0];
  if (chosen === undefined) {
    return { host, verdict: 'review', reasons: ['no qualifying candidate'], candidates };
  }
  const orgType = chosen.orgType;
  const sourceClass = ORG_TYPE_SOURCE_CLASS[orgType];

  // Restated as code so it cannot be lost in a refactor: government authority is only ever
  // granted through a government-agency item that is itself authority-controlled.
  if (
    sourceClass === 'government_record' &&
    (orgType !== 'government_agency' || chosen.idCount === 0)
  ) {
    return {
      host,
      verdict: 'review',
      reasons: [`refusing to grant government_record to ${host} without a government-agency item`],
      candidates,
    };
  }

  const matchedWebsite = chosen.candidate.officialWebsites.find((website) =>
    websiteAuthorizesHost(website, host),
  );
  if (matchedWebsite === undefined) {
    return { host, verdict: 'review', reasons: ['no matching official website'], candidates };
  }
  const alternates = qualified.filter((row) => row.candidate.qid !== chosen.candidate.qid);

  return {
    host,
    verdict: 'accept',
    reasons: [
      `${describeCandidate(chosen.candidate)} lists ${matchedWebsite} as its official website, is a ${orgType}, and carries ${chosen.idCount} authority identifier(s)`,
    ],
    entry: {
      host,
      sourceClass,
      orgType,
      label: chosen.candidate.label,
      basis: {
        wikidata: chosen.candidate.qid,
        officialWebsite: matchedWebsite,
        authorityIds: chosen.candidate.authorityIds,
        instanceOf: chosen.candidate.instanceOf,
      },
      ...(alternates.length === 0
        ? {}
        : {
            notes: `other items also claiming this host: ${alternates
              .map((row) => describeCandidate(row.candidate))
              .join(', ')}`,
          }),
    },
    candidates,
  };
}

/** Insert-or-replace by host, then sort, so the file is stable across runs. */
export function mergeEntries(
  existing: readonly SourceRegisterEntry[],
  incoming: readonly SourceRegisterEntry[],
): readonly SourceRegisterEntry[] {
  const byHost = new Map(existing.map((entry) => [entry.host, entry]));
  for (const entry of incoming) byHost.set(entry.host, entry);
  return [...byHost.values()].sort((left, right) => left.host.localeCompare(right.host));
}

/** The entries `apply` will write, and the proposals it refuses. */
export function selectApplicableProposals(
  file: ProposalFile,
  reviewedBy: string,
  reviewedAt: string,
): {
  readonly entries: readonly SourceRegisterEntry[];
  readonly refused: readonly {
    readonly host: string;
    readonly verdict: string;
    readonly reason: string;
  }[];
} {
  const entries: SourceRegisterEntry[] = [];
  const refused: { host: string; verdict: string; reason: string }[] = [];
  for (const proposal of file.proposals) {
    if (proposal.verdict !== 'accept' || proposal.entry === undefined) {
      refused.push({
        host: proposal.host,
        verdict: proposal.verdict,
        reason: proposal.reasons[0] ?? 'no reason recorded',
      });
      continue;
    }
    entries.push({
      ...proposal.entry,
      reviewedBy,
      reviewedAt,
      // The basis was checked against Wikidata when the proposal was produced, not now.
      verifiedAt: file.checkedAt,
    });
  }
  return { entries, refused };
}

// ---------------------------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default fetcher: the DNS-pinned safe path, never a bare `fetch()`. */
export const defaultJsonFetcher: JsonFetcher = async (url) => {
  const result = await safeFetchJson(url, {
    userAgent: SOURCE_REGISTER_USER_AGENT,
    maxDurationMs: 70_000,
  });
  if (!result.ok) throw new Error(`fetch failed (${result.reason}): ${url}`);
  return result.value;
};

export type ProposeDependencies = {
  readonly fetchJson: JsonFetcher;
  readonly pace?: (ms: number) => Promise<void>;
  readonly log?: (message: string) => void;
};

function sparqlUrl(query: string): string {
  return `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;
}

function searchUrl(host: string): string {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: host,
    srlimit: String(SEARCH_CANDIDATE_LIMIT),
    srnamespace: '0',
    format: 'json',
    formatversion: '2',
  });
  return `${WIKIDATA_API}?${params.toString()}`;
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * Proposes an entry for every host, hitting Wikidata for the evidence.
 *
 * Exported with its dependencies injected so the verdict path can be exercised against fixture
 * responses; nothing here reaches the network in a test.
 */
export async function proposeHosts(
  hosts: readonly string[],
  deps: ProposeDependencies,
): Promise<ProposalFile> {
  const pace = deps.pace ?? sleep;
  const log = deps.log ?? (() => {});
  const checkedAt = new Date().toISOString();

  // Stage 1: exact-IRI probe for every host at once.
  const hostToQids = new Map<string, Set<string>>();
  const probeBatches = chunk(hosts, PROBE_BATCH_SIZE);
  for (const [index, batch] of probeBatches.entries()) {
    if (index > 0) await pace(SPARQL_PACE_MS);
    log(`probe batch ${index + 1}/${probeBatches.length} (${batch.length} hosts)`);
    const payload = await deps.fetchJson(sparqlUrl(buildOfficialWebsiteProbeQuery(batch)));
    for (const binding of sparqlBindings(payload)) {
      const website = binding.website?.value;
      const item = binding.item?.value;
      if (!website || !item) continue;
      const host = batch.find((candidate) => websiteAuthorizesHost(website, candidate));
      if (host === undefined) continue;
      (hostToQids.get(host) ?? setIn(hostToQids, host)).add(qidFromUri(item));
    }
  }

  // Stage 2: wiki search as a candidate generator for the misses.
  const missed = hosts.filter((host) => (hostToQids.get(host)?.size ?? 0) === 0);
  for (const [index, host] of missed.entries()) {
    if (index > 0) await pace(SPARQL_PACE_MS);
    log(`search fallback ${index + 1}/${missed.length}: ${host}`);
    let payload: unknown;
    try {
      payload = await deps.fetchJson(searchUrl(host));
    } catch (error) {
      log(`  search failed for ${host}: ${String(error)}`);
      continue;
    }
    const hits = (payload as { query?: { search?: { title?: string }[] } }).query?.search ?? [];
    const bucket = hostToQids.get(host) ?? setIn(hostToQids, host);
    for (const hit of hits) {
      if (hit.title && /^Q\d+$/u.test(hit.title)) bucket.add(hit.title);
    }
  }

  // Facts for every distinct candidate, in batches.
  const allQids = [...new Set([...hostToQids.values()].flatMap((set) => [...set]))];
  const candidatesByQid = new Map<string, WikidataCandidate>();
  const factBatches = chunk(allQids, 40);
  for (const [index, batch] of factBatches.entries()) {
    await pace(SPARQL_PACE_MS);
    log(`facts batch ${index + 1}/${factBatches.length} (${batch.length} items)`);
    const payload = await deps.fetchJson(sparqlUrl(buildItemFactsQuery(batch)));
    for (const [qid, candidate] of collectCandidates(sparqlBindings(payload))) {
      candidatesByQid.set(qid, candidate);
    }
  }

  // One subclass-closure resolution for every class seen.
  const classQids = [
    ...new Set([...candidatesByQid.values()].flatMap((candidate) => candidate.instanceOf)),
  ];
  const closure = new Map<string, string[]>();
  for (const [index, batch] of chunk(classQids, 200).entries()) {
    await pace(SPARQL_PACE_MS);
    log(`class closure batch ${index + 1}`);
    const payload = await deps.fetchJson(sparqlUrl(buildClassClosureQuery(batch)));
    for (const binding of sparqlBindings(payload)) {
      const cls = binding.cls?.value;
      const root = binding.root?.value;
      if (!cls || !root) continue;
      const key = qidFromUri(cls);
      const roots = closure.get(key) ?? [];
      roots.push(qidFromUri(root));
      closure.set(key, roots);
    }
  }

  const proposals = hosts.map((host) =>
    verdictForHost(
      host,
      [...(hostToQids.get(host) ?? [])]
        .map((qid) => candidatesByQid.get(qid))
        .filter((candidate): candidate is WikidataCandidate => candidate !== undefined),
      closure,
    ),
  );
  return { checkedAt, proposals };
}

// ---------------------------------------------------------------------------------------------
// Verbs
// ---------------------------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): Readonly<Record<string, string | boolean>> {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args[name] = true;
    } else {
      args[name] = next;
      index += 1;
    }
  }
  return args;
}

function readProposalFile(path: string): ProposalFile {
  return JSON.parse(readFileSync(path, 'utf8')) as ProposalFile;
}

function writeRegister(file: SourceRegisterFile): void {
  writeFileSync(sourceRegisterPath(), `${JSON.stringify(file, null, 2)}\n`);
}

async function runPropose(args: Readonly<Record<string, string | boolean>>): Promise<number> {
  const hosts = new Set<string>();
  if (args['from-list'] === true)
    for (const host of REPUTABLE_SECONDARY_HOST_SUFFIXES) hosts.add(host);
  if (typeof args.host === 'string') hosts.add(args.host);
  if (typeof args.hosts === 'string') {
    for (const host of args.hosts.split(',')) if (host.trim()) hosts.add(host.trim());
  }
  if (hosts.size === 0) {
    console.error('propose needs --host, --hosts a,b,c, or --from-list');
    return 2;
  }
  const file = await proposeHosts([...hosts].sort(), {
    fetchJson: defaultJsonFetcher,
    log: (message) => console.error(message),
  });
  const output = typeof args.out === 'string' ? args.out : undefined;
  if (output) {
    writeFileSync(output, `${JSON.stringify(file, null, 2)}\n`);
    console.error(`wrote ${output}`);
  } else {
    console.log(JSON.stringify(file, null, 2));
  }
  const counts = { accept: 0, review: 0, reject: 0 };
  for (const proposal of file.proposals) counts[proposal.verdict] += 1;
  console.error(`accept ${counts.accept}  review ${counts.review}  reject ${counts.reject}`);
  return 0;
}

function runApply(args: Readonly<Record<string, string | boolean>>): number {
  if (typeof args.file !== 'string' || typeof args['reviewed-by'] !== 'string') {
    console.error('apply needs --file <proposals.json> --reviewed-by "<name>"');
    return 2;
  }
  const proposals = readProposalFile(args.file);
  const { entries, refused } = selectApplicableProposals(
    proposals,
    args['reviewed-by'],
    new Date().toISOString(),
  );
  const register = loadSourceRegister();
  const merged = mergeEntries(register.entries, entries);
  writeRegister({ version: register.version, entries: merged });
  for (const row of refused) {
    console.error(`refused ${row.host} (${row.verdict}): ${row.reason}`);
  }
  console.log(
    `applied ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}; register now holds ${merged.length}`,
  );
  return 0;
}

/** Liveness failures worth one retry: a slow or flaky answer, not a dead or repointed host. */
const TRANSIENT_LIVENESS_REASONS = new Set(['duration_exceeded', 'transport_failed']);

export type VerifyDrift = {
  readonly host: string;
  readonly problems: readonly string[];
};

/** Re-checks entries against Wikidata and the live host. Pure enough to test with fixtures. */
export async function verifyEntries(
  entries: readonly SourceRegisterEntry[],
  deps: ProposeDependencies & {
    readonly reachable?: (
      url: string,
    ) => Promise<{ readonly reachable: boolean; readonly reason?: string }>;
  },
): Promise<{ readonly drift: readonly VerifyDrift[]; readonly clean: readonly string[] }> {
  const pace = deps.pace ?? sleep;
  const log = deps.log ?? (() => {});
  const reachable =
    deps.reachable ??
    ((url: string) => safeFetchIsReachable(url, { userAgent: SOURCE_REGISTER_USER_AGENT }));

  const qids = [...new Set(entries.map((entry) => entry.basis.wikidata))];
  const candidates = new Map<string, WikidataCandidate>();
  const factBatches = chunk(qids, 40);
  for (const [index, batch] of factBatches.entries()) {
    if (index > 0) await pace(SPARQL_PACE_MS);
    log(`facts batch ${index + 1}/${factBatches.length}`);
    const payload = await deps.fetchJson(sparqlUrl(buildItemFactsQuery(batch)));
    for (const [qid, candidate] of collectCandidates(sparqlBindings(payload))) {
      candidates.set(qid, candidate);
    }
  }
  const classQids = [
    ...new Set([...candidates.values()].flatMap((candidate) => candidate.instanceOf)),
  ];
  const closure = new Map<string, string[]>();
  for (const batch of chunk(classQids, 200)) {
    await pace(SPARQL_PACE_MS);
    const payload = await deps.fetchJson(sparqlUrl(buildClassClosureQuery(batch)));
    for (const binding of sparqlBindings(payload)) {
      const cls = binding.cls?.value;
      const root = binding.root?.value;
      if (!cls || !root) continue;
      const key = qidFromUri(cls);
      const roots = closure.get(key) ?? [];
      roots.push(qidFromUri(root));
      closure.set(key, roots);
    }
  }

  const drift: VerifyDrift[] = [];
  const clean: string[] = [];
  for (const entry of entries) {
    const problems: string[] = [];
    const candidate = candidates.get(entry.basis.wikidata);
    if (candidate === undefined) {
      problems.push(
        `Wikidata item ${entry.basis.wikidata} returned nothing — deleted, merged or renumbered`,
      );
    } else {
      const stillClaims = candidate.officialWebsites.some((website) =>
        websiteAuthorizesHost(website, entry.host),
      );
      if (!stillClaims) {
        problems.push(
          `${entry.basis.wikidata} no longer lists ${entry.host} as its official website (now: ${candidate.officialWebsites.join(', ') || 'none'})`,
        );
      }
      if (authorityIdCount(candidate) === 0) {
        problems.push(`${entry.basis.wikidata} no longer carries any authority identifier`);
      }
      const orgType = orgTypeForClasses(candidate.instanceOf, closure);
      if (orgType === undefined) {
        problems.push(
          `${entry.basis.wikidata} instance-of ${candidate.instanceOf.join(', ') || 'none'} no longer reaches an allowlisted class`,
        );
      } else if (orgType !== entry.orgType) {
        problems.push(
          `${entry.basis.wikidata} now resolves to ${orgType}, registered as ${entry.orgType}`,
        );
      }
    }
    // One retry before calling a slow institutional site "drifted". Measured: a state
    // historical society's homepage redirects once and then takes eight seconds, which trips a
    // timeout often enough that the check would cry wolf and get ignored.
    let liveness = await reachable(`https://${entry.host}/`);
    if (!liveness.reachable && TRANSIENT_LIVENESS_REASONS.has(liveness.reason ?? '')) {
      await pace(2_000);
      liveness = await reachable(`https://${entry.host}/`);
    }
    if (!liveness.reachable) {
      problems.push(`https://${entry.host}/ did not answer (${liveness.reason})`);
    }
    if (problems.length === 0) clean.push(entry.host);
    else drift.push({ host: entry.host, problems });
  }
  return { drift, clean };
}

async function runVerify(args: Readonly<Record<string, string | boolean>>): Promise<number> {
  const register = loadSourceRegister();
  const olderThanDays =
    typeof args['older-than'] === 'string' ? Number(args['older-than']) : undefined;
  const cutoff =
    olderThanDays === undefined ? undefined : Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const due = register.entries.filter(
    (entry) => cutoff === undefined || Date.parse(entry.verifiedAt) < cutoff,
  );
  if (due.length === 0) {
    console.log('no entries due for verification');
    return 0;
  }
  const { drift, clean } = await verifyEntries(due, {
    fetchJson: defaultJsonFetcher,
    log: (message) => console.error(message),
  });
  for (const row of drift) {
    console.log(`DRIFT ${row.host}`);
    for (const problem of row.problems) console.log(`  - ${problem}`);
  }
  console.log(`${clean.length} clean, ${drift.length} drifted, of ${due.length} checked`);
  if (args.record === true && clean.length > 0) {
    const verifiedAt = new Date().toISOString();
    const cleanHosts = new Set(clean);
    writeRegister({
      version: register.version,
      entries: register.entries.map((entry) =>
        cleanHosts.has(entry.host) ? { ...entry, verifiedAt } : entry,
      ),
    });
    console.log(`recorded verifiedAt=${verifiedAt} for ${clean.length} entries`);
  }
  if (drift.length > 0) {
    console.log('nothing was deleted. A person decides whether a drifted host stays.');
  }
  return drift.length > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  const [verb, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let code: number;
  switch (verb) {
    case 'propose':
      code = await runPropose(args);
      break;
    case 'apply':
      code = runApply(args);
      break;
    case 'verify':
      code = await runVerify(args);
      break;
    default:
      console.error('usage: source-register.ts <propose|apply|verify> [options]');
      code = 2;
  }
  process.exitCode = code;
}

// Only run when invoked directly; the test imports this module for its pure functions.
const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  await main();
}
