/**
 * The source register: which hosts are institutions, and on whose authority.
 *
 * WHAT THIS REPLACES
 *
 * `classifySourceForConfidence` used to place a host by shape — `.gov`/`.mil` and `si.edu` were
 * government records, `.edu` and two archival domains were reputable secondary, and everything
 * else fell through a hand-typed suffix list to `unknown`, worth 0.2 authority. The Academy of
 * American Poets, the Schomburg Center and a state historical society all landed in that tail,
 * so a claim resting on one of them scored 0.583 — below a crowd-edited marker database at
 * 0.720 — and appending such a source to a record LOWERED its minimum claim confidence under
 * the 0.75 publish floor. More research made a record less publishable. The suffix list fixed
 * that for the hosts someone had typed in, which is not a mechanism, it is a backlog.
 *
 * THE ACCEPTANCE RULE, AND WHY A FAKE SITE CANNOT PASS IT
 *
 * A host enters this register only through an authority-controlled item that names THAT HOST as
 * its own official website. Concretely, all three must hold at once:
 *
 *   1. Some Wikidata item's official website (P856) is the ROOT of the host being registered —
 *      `https://host/` or its `www.` form, compared as a parsed hostname, never as a substring
 *      and never a deep link. A deep link says "this page is about me", which is a different
 *      claim: on the first migration run a Texas town's P856 pointed at its Handbook of Texas
 *      article, and without the root rule the tool would have registered the publisher's whole
 *      domain on the town's authority.
 *   2. That item carries at least one library or research authority identifier: LCNAF (P244),
 *      VIAF (P214), ISNI (P213), ROR (P6782), GRID (P2427) or the IMLS Museum Universe Data
 *      File id (P6006). These come from national libraries and research-infrastructure
 *      registries that mint records for institutions they have actually cataloged.
 *   3. That item's instance-of (P31), followed up the subclass chain (P279*), lands on one of
 *      the classes in `WIKIDATA_CLASS_ALLOWLIST` below.
 *
 * A look-alike domain — `nypl.org.evil.example`, `schomburg-center.co` — fails at (1): no
 * cataloged institution claims it as its website, and hostname comparison will not let it
 * borrow a real host's suffix. A vanity item created for a fake museum fails at (2): the
 * attacker would have to get a national library to catalog the invention. An item that exists
 * but describes a website, a book, or a prize rather than an institution fails at (3).
 *
 * Wikipedia's own "official website" line is a corroborating signal a reviewer may look at. It
 * is never sufficient on its own: it is uncontrolled free text with no authority record behind
 * it.
 *
 * Government authority is held to a further rule. The register never grants
 * `government_record` to a host outside a government TLD unless the item is a government
 * agency AND carries an authority identifier. A state park foundation's `.org` is a real
 * institution; it is not a federal record, and the difference is 0.2 of authority weight.
 *
 * The register also declines to hold `.gov` and `.mil` hosts at all. Those are already
 * `government_record` from their TLD, decided before this register is consulted, so an entry
 * could only ever lower them — the Maryland State Archives is an `archive` in Wikidata's terms,
 * and an archive is reputable_secondary.
 *
 * DRIFT
 *
 * Sites change hands. Every entry carries `verifiedAt`, and `source-register.ts verify`
 * re-checks the three conditions plus a live HTTPS request against the host. Drift is printed
 * and exits non-zero; nothing is ever deleted automatically, because a host that stops
 * answering for a week is not the same event as a host that has been sold.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTER_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-register.json');

/**
 * The organization types the register can hold, and what each is worth.
 *
 * Every type here is reachable: each one is produced by at least one class in
 * `WIKIDATA_CLASS_ALLOWLIST`. A type nothing can produce would be a promise the tool cannot
 * keep, since `apply` only writes entries the verdict logic accepted.
 *
 * Two candidates were considered and left out. "Humanities council" is not a Wikidata class,
 * and the sites that prompted it (64parishes.org for the Louisiana Endowment for the
 * Humanities, connecticuthistory.org for Connecticut Humanities) are online encyclopedias in
 * Wikidata's own terms, which is what they are to a reader too. "Heritage trust" likewise has
 * no class of its own; a trust that runs a listed site is a cultural institution.
 */
export const SOURCE_REGISTER_ORG_TYPES = [
  /** A collecting institution with a curatorial staff. The plain case for the whole register. */
  'museum',
  /** Holds original records. The closest a secondary host gets to primary evidence. */
  'archive',
  /** Includes public libraries with named research collections — Schomburg, Harsh, Vivian Harsh. */
  'library',
  /** State and county historical societies: the tail that started this work. */
  'historical_society',
  /** Scholarly and professional bodies — ACS, AIP, IEEE, SABR — publishing edited scholarship. */
  'learned_society',
  /** State encyclopedias with named editors and a review process, not open wikis. */
  'encyclopedia',
  /** Degree-granting institutions, including the ones that host a state hall of fame. */
  'university',
  /** Research institutes and centers that publish their own findings. */
  'research_institute',
  /** Halls of fame: the canonical roster of their own inductees, and nothing beyond that. */
  'hall_of_fame',
  /** A government body that is not on a government TLD — a state park service on `.org`. */
  'government_agency',
  /** Public broadcasters with editorial independence and a newsroom, not a syndicator. */
  'public_broadcaster',
  /** Preservation trusts, heritage trails, cultural foundations. */
  'cultural_institution',
  /** Cemeteries and burial grounds that publish their own interment records. */
  'cemetery',
  /** A newspaper of record. Registered so it grades as reportage, not so it grades higher. */
  'news_publisher',
] as const;

export type SourceRegisterOrgType = (typeof SOURCE_REGISTER_ORG_TYPES)[number];

/** The confidence-engine source classes the register can assign. */
export type SourceRegisterClass = 'government_record' | 'reputable_secondary' | 'news_reportage';

/**
 * What each organization type is worth to the confidence engine.
 *
 * Only a government agency reaches `government_record`, and only under the extra check in
 * `verdictForCandidate`. A newspaper grades `news_reportage` (0.55) — LOWER than the 0.75 an
 * unregistered-but-recognized host would get from the curated list. That is the point: the
 * register exists to place a host correctly, not to promote it.
 */
export const ORG_TYPE_SOURCE_CLASS: Readonly<Record<SourceRegisterOrgType, SourceRegisterClass>> = {
  museum: 'reputable_secondary',
  archive: 'reputable_secondary',
  library: 'reputable_secondary',
  historical_society: 'reputable_secondary',
  learned_society: 'reputable_secondary',
  encyclopedia: 'reputable_secondary',
  university: 'reputable_secondary',
  research_institute: 'reputable_secondary',
  hall_of_fame: 'reputable_secondary',
  government_agency: 'government_record',
  public_broadcaster: 'reputable_secondary',
  cultural_institution: 'reputable_secondary',
  cemetery: 'reputable_secondary',
  news_publisher: 'news_reportage',
};

/**
 * Wikidata classes that qualify a host, and the organization type each yields.
 *
 * These are ROOTS: an item qualifies when its P31 reaches one of them through P279* (subclass
 * of, transitively). "State historical society of Minnesota" does not need its own line here;
 * it is a subclass of historical society. That closure is what makes this scale without anyone
 * typing hosts into a source file.
 *
 * Roots are chosen narrow on purpose. `organization` (Q43229) and `nonprofit organization`
 * (Q163740) are excluded even though most entries would satisfy them, because every
 * incorporated body in the world is one and the test would stop meaning anything. An
 * institution whose only claim is "nonprofit" comes back `review` and a person decides.
 *
 * Each root, and why it is here:
 * - Q33506 museum, Q166118 archives, Q7075 library — collecting institutions; the register's
 *   core case, and the class of body IMLS and national libraries actually catalog.
 * - Q5774403 historical society — the state and county societies whose misclassification as
 *   `unknown` is the measured problem this register fixes.
 * - Q955824 learned society — a scholarly body whose publications are edited and attributable.
 * - Q5292 encyclopedia and Q615699 online encyclopedia — reference works with named editors.
 *   Wikipedia does not reach the register through this door: it is handled earlier as a bridge
 *   source, before the register is consulted.
 * - Q3918 university and Q38723 higher education institution — the register's `.edu` case,
 *   and the route by which a university-hosted hall of fame (samford.edu) is placed.
 * - Q31855 research institute — publishes its own findings under its own name.
 * - Q1046088 hall of fame — authoritative for its own inductee roster.
 * - Q327333 government agency and Q20857085 state agency of the United States — the only route
 *   to `government_record` off a government TLD.
 * - Q1126006 public broadcaster — an editorially independent newsroom, distinct from a
 *   commercial outlet, and the class WLRN and its peers sit in.
 * - Q3152824 cultural institution — preservation trusts and heritage trails that are none of
 *   the above.
 * - Q39614 cemetery — burial grounds publishing their own interment records.
 * - Q11032 newspaper — present so a newspaper is graded AS a newspaper rather than falling to
 *   `unknown` or being mistaken for an institution.
 */
export const WIKIDATA_CLASS_ALLOWLIST: Readonly<Record<string, SourceRegisterOrgType>> = {
  Q33506: 'museum',
  Q166118: 'archive',
  Q7075: 'library',
  Q5774403: 'historical_society',
  Q955824: 'learned_society',
  Q5292: 'encyclopedia',
  Q615699: 'encyclopedia',
  Q3918: 'university',
  Q38723: 'university',
  Q31855: 'research_institute',
  Q1046088: 'hall_of_fame',
  Q327333: 'government_agency',
  Q20857085: 'government_agency',
  Q1126006: 'public_broadcaster',
  Q3152824: 'cultural_institution',
  Q39614: 'cemetery',
  Q11032: 'news_publisher',
};

/** Authority-control identifier properties, most specific to institutions first. */
export const AUTHORITY_ID_PROPERTIES = {
  P244: 'lcnaf',
  P214: 'viaf',
  P213: 'isni',
  P6782: 'ror',
  P2427: 'grid',
  P6006: 'imls',
} as const;

export type AuthorityIdKey = (typeof AUTHORITY_ID_PROPERTIES)[keyof typeof AUTHORITY_ID_PROPERTIES];

export type SourceRegisterBasis = {
  /** The Wikidata item the entry rests on. */
  readonly wikidata: string;
  /** The P856 value that matched the host, as stored on the item. */
  readonly officialWebsite: string;
  /** At least one is required; an entry with none of these is not acceptable. */
  readonly authorityIds: Partial<Record<AuthorityIdKey, string>>;
  /** The item's own P31 values, before subclass closure — kept so drift is visible. */
  readonly instanceOf: readonly string[];
};

export type SourceRegisterEntry = {
  /** A registrable-domain suffix, matched as host-or-subdomain. Never a substring. */
  readonly host: string;
  readonly sourceClass: SourceRegisterClass;
  readonly orgType: SourceRegisterOrgType;
  readonly label: string;
  readonly basis: SourceRegisterBasis;
  /** The person who accepted the entry. Not a bot name — someone answers for this. */
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  /** Last time `verify` re-checked the basis against Wikidata and the live host. */
  readonly verifiedAt: string;
  readonly notes?: string;
};

export type SourceRegisterFile = {
  readonly version: number;
  readonly entries: readonly SourceRegisterEntry[];
};

let cached: SourceRegisterFile | undefined;

/** Reads the register from disk once per process. */
export function loadSourceRegister(): SourceRegisterFile {
  cached ??= JSON.parse(readFileSync(REGISTER_PATH, 'utf8')) as SourceRegisterFile;
  return cached;
}

/** Test seam: replaces the in-process register. Pass `undefined` to fall back to the file. */
export function setSourceRegisterForTesting(file: SourceRegisterFile | undefined): void {
  cached = file;
}

/** Absolute path of the register file, for the CLI that writes it. */
export function sourceRegisterPath(): string {
  return REGISTER_PATH;
}

function normalizeHostname(hostname: string): string {
  // Trailing dot is the DNS root and is not part of the name for comparison purposes.
  return hostname.toLowerCase().replace(/\.$/u, '');
}

/**
 * True when `hostname` is exactly `host` or a subdomain of it.
 *
 * The same rule `tier1-sources.ts` uses, and for the same reason: a substring test would accept
 * `nypl.org.evil.example` as the New York Public Library
 * (CodeQL js/incomplete-url-substring-sanitization).
 */
export function hostMatchesRegisterHost(hostname: string, host: string): boolean {
  const normalized = normalizeHostname(hostname);
  const target = normalizeHostname(host);
  return normalized === target || normalized.endsWith(`.${target}`);
}

/**
 * The register entry covering `hostname`, or undefined.
 *
 * When two entries could match — a host and a parent domain both registered — the more specific
 * one wins, so a subdomain can be classified differently from its parent if someone ever needs
 * that.
 */
export function lookupSourceRegister(
  hostname: string | undefined,
): SourceRegisterEntry | undefined {
  if (hostname === undefined || hostname.trim().length === 0) return undefined;
  const normalized = normalizeHostname(hostname);
  let best: SourceRegisterEntry | undefined;
  for (const entry of loadSourceRegister().entries) {
    if (!hostMatchesRegisterHost(normalized, entry.host)) continue;
    if (best === undefined || entry.host.length > best.host.length) best = entry;
  }
  return best;
}

/** Same lookup, keyed by a full URL. Returns undefined for anything that is not a URL. */
export function lookupSourceRegisterByUrl(
  url: string | undefined,
): SourceRegisterEntry | undefined {
  if (!url) return undefined;
  try {
    return lookupSourceRegister(new URL(url).hostname);
  } catch {
    return undefined;
  }
}
