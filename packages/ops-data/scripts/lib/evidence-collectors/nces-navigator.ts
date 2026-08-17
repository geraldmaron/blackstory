/**
 * repo-2t04.6 — NCES College Navigator collector for the `us-ed-hbcu-*` lane.
 *
 * 22 HBCU entities are blocked from publish by the confidence gate: each has exactly ONE
 * evidence lineage (a Wikipedia article), which caps `lineageIndependence` at 0.4 and lands the
 * whole score at 0.720, just under the 0.75 floor. 6 sibling entities in the same lane already
 * cleared the floor because they carry a second, independent, non-Wikipedia source. See
 * `bd show repo-2t04.6` for the full root-cause writeup.
 *
 * Every US degree-granting institution has a stable page at
 *   https://nces.ed.gov/collegenavigator/?id=<UNITID>
 * where UNITID is the Department of Education's own numeric identifier for the institution. For
 * this lane, UNITID is literally the numeric suffix of the entity_id (`us-ed-hbcu-107840` ->
 * `107840`, Shorter College) — so there is no search step and no place-corroboration ambiguity;
 * the URL already IS the identity, the same shape as `collectDcHpo` in sweep-entity-evidence.ts.
 *
 * WHY NOT A RAW FETCH-AND-STRIP. A raw fetch of the Navigator page returns ~140KB of HTML, almost
 * all of it search-form boilerplate (every checkbox and dropdown in the site's own search UI is
 * rendered on every institution page) plus JS/analytics chrome. Regex tag-stripping over that
 * produces no genuinely quotable prose — the page has none; it is a data table, not an article —
 * and safeFetchPage's Trafilatura extraction (tuned for article bodies) fares no better against a
 * page that IS a form. So this collector parses the labelled fact table directly (institution
 * name, address, type/control, HBCU designation, awards offered, enrollment, campus setting) and
 * SYNTHESIZES 1-4 short factual sentences from those structured fields — not scraped verbatim
 * prose, because the page carries none to scrape.
 *
 * FAIL CLOSED. `parseCollegeNavigatorFacts` returns null — never a best-effort guess — when: the
 * header block does not parse, the page's own "IPEDS ID" does not echo back the requested UNITID
 * (a redirect or a since-retired UNITID would otherwise silently attach the wrong institution's
 * facts to this entity), or the page does not carry NCES's own "Historically Black College or
 * University" designation (this collector exists only for the HBCU lane; an institution page that
 * does not carry that flag is not corroborating evidence for an HBCU claim, regardless of how
 * cleanly it otherwise parses).
 */
import { createHash } from 'node:crypto';
import { safeFetchPage, type SafeFetchedPage } from '../safe-fetch.ts';
import { checkSubjectIdentity, type SubjectIdentity } from './subject-identity.ts';
import { assessText, type QualityVerdict } from './text-quality.ts';

/** NCES publishes College Navigator data under this notice; carried in provenance per row. */
export const NCES_RIGHTS_STATUS = 'public-domain-us-federal';

const ENTITY_ID_RE = /^us-ed-hbcu-([0-9]+)$/u;

/** Pulls the UNITID out of a `us-ed-hbcu-<UNITID>` entity_id. Null for any other shape. */
export function unitIdFromEntityId(entityId: string): string | null {
  const match = ENTITY_ID_RE.exec(entityId.trim());
  return match ? match[1]! : null;
}

export function navigatorUrl(unitId: string): string {
  return `https://nces.ed.gov/collegenavigator/?id=${encodeURIComponent(unitId)}`;
}

export type CollegeNavigatorFacts = {
  readonly unitId: string;
  readonly name: string;
  readonly address: string;
  /** "2-year" | "4-year" | "Less than 2-year", as NCES prints it. Undefined if unparsed. */
  readonly level?: string;
  /** "Public" | "Private not-for-profit" | "Private for-profit", as NCES prints it. */
  readonly control?: string;
  /** Degree/certificate levels this institution awards, in NCES's own order. */
  readonly awardsOffered: readonly string[];
  readonly campusSetting?: string;
  readonly campusHousing?: string;
  readonly studentPopulation?: string;
  readonly studentFacultyRatio?: string;
  /** Always true for a fact object this module returns — see module docs on failing closed. */
  readonly isHbcu: true;
};

/** Decodes the handful of HTML entities that appear in this page's plain-text fields. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gu, '&')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>');
}

/** Strips tags from a `<td>` cell's inner HTML, turning `<br />` into a list separator. */
function cellToLines(cellHtml: string): readonly string[] {
  return decodeEntities(cellHtml.replace(/<br\s*\/?>/giu, '\n').replace(/<[^>]+>/gu, ' '))
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line.length > 0);
}

/**
 * USPS-style single/double-letter directional tokens, expanded to full words. NCES prints
 * institution addresses in this abbreviated postal form ("604 Locust St, N Little Rock, Arkansas"
 * for North Little Rock; "300 College St NE" for a street's Northeast quadrant), which is the
 * SAME city, just not the string the roster's `city` field carries. Expanding it here — once, on
 * the independently-sourced NCES address itself — is what lets the shared place-identity gate
 * (built to catch "Covington VA is not Covington KY") recognize a genuine match instead of
 * quarantining every capture on an abbreviation. This is a meaning-preserving normalization of
 * NCES's own data, not a substitution of the roster's claimed value: the same `subject-identity.ts`
 * module already does the mirror-image expansion for state abbreviations (`mentionsState`), and
 * `nrhp-nomination.ts` normalizes far more aggressively over OCR text for the same reason.
 */
const DIRECTIONAL_ABBREVIATIONS: ReadonlyMap<string, string> = new Map([
  ['N', 'North'],
  ['S', 'South'],
  ['E', 'East'],
  ['W', 'West'],
  ['NE', 'Northeast'],
  ['NW', 'Northwest'],
  ['SE', 'Southeast'],
  ['SW', 'Southwest'],
]);

function expandDirectionalAbbreviations(address: string): string {
  return address.replace(/\b(N|S|E|W|NE|NW|SE|SW)\b/gu, (token) => {
    // Word-boundary tokens only, and only the exact-case abbreviation forms NCES prints
    // (uppercase). Lowercase "n"/"s"/etc. never occur as directionals in this data and would
    // otherwise risk mangling ordinary words if the regex were case-insensitive.
    return DIRECTIONAL_ABBREVIATIONS.get(token) ?? token;
  });
}

const HEADER_RE = /<span class="headerlg">([^<]+)<\/span><br\s*\/?>([^<]+)<\/span>/u;
const IPEDS_ID_RE = /IPEDS ID:\s*([0-9]+)/u;
const ROW_RE = /<td scope="row" class="srb">([^<:]+):&nbsp;&nbsp;<\/td><td>([\s\S]*?)<\/td>/gu;
const HBCU_MARKER = 'Historically Black College or University';
/**
 * The "Other Characteristics" label and everything up to the NEXT bold field label. NOT a
 * whole-document search: every College Navigator page's own search-form sidebar renders a
 * "Specialized Mission" <select> whose options literally include the string
 * "Historically Black College or University" as a filter choice — present on EVERY institution's
 * page, HBCU or not. A `html.includes(HBCU_MARKER)` check over the whole document is always true
 * and verifies nothing; the designation only means something read out of this specific labelled
 * block in the institution's own characteristics list.
 */
const OTHER_CHARACTERISTICS_RE =
  /Other Characteristics<\/div>([\s\S]*?)<div style="font-weight:bold;padding-top:6px">/u;

/**
 * Parses the labelled fact table on a College Navigator page. Returns null (never a partial or
 * best-effort object) when the page does not corroborate `expectedUnitId` as an HBCU — see module
 * docs for the three fail-closed checks.
 */
export function parseCollegeNavigatorFacts(
  html: string,
  expectedUnitId: string,
): CollegeNavigatorFacts | null {
  const ipedsMatch = IPEDS_ID_RE.exec(html);
  if (ipedsMatch === null || ipedsMatch[1] !== expectedUnitId) return null;

  const headerMatch = HEADER_RE.exec(html);
  if (headerMatch === null) return null;
  const name = decodeEntities(headerMatch[1]!).trim();
  const rawAddress = decodeEntities(headerMatch[2]!).trim();
  if (name.length === 0 || rawAddress.length === 0) return null;
  const address = expandDirectionalAbbreviations(rawAddress);

  const characteristicsBlock = OTHER_CHARACTERISTICS_RE.exec(html)?.[1];
  if (characteristicsBlock === undefined || !characteristicsBlock.includes(HBCU_MARKER)) {
    return null;
  }

  const rows = new Map<string, readonly string[]>();
  ROW_RE.lastIndex = 0;
  let rowMatch = ROW_RE.exec(html);
  while (rowMatch !== null) {
    rows.set(rowMatch[1]!.trim(), cellToLines(rowMatch[2]!));
    rowMatch = ROW_RE.exec(html);
  }

  const typeLine = rows.get('Type')?.[0];
  const [level, control] =
    typeLine !== undefined && typeLine.includes(',')
      ? [typeLine.slice(0, typeLine.indexOf(',')).trim(), typeLine.slice(typeLine.indexOf(',') + 1).trim()]
      : [undefined, typeLine];

  const campusSetting = rows.get('Campus setting')?.[0];
  const campusHousing = rows.get('Campus housing')?.[0];
  const studentPopulation = rows.get('Student population')?.[0];
  const studentFacultyRatio = rows.get('Student-to-faculty ratio')?.[0];

  return {
    unitId: expectedUnitId,
    name,
    address,
    ...(level !== undefined && { level }),
    ...(control !== undefined && { control }),
    awardsOffered: rows.get('Awards offered') ?? [],
    ...(campusSetting !== undefined && { campusSetting }),
    ...(campusHousing !== undefined && { campusHousing }),
    ...(studentPopulation !== undefined && { studentPopulation }),
    ...(studentFacultyRatio !== undefined && { studentFacultyRatio }),
    isHbcu: true,
  };
}

/** Same hashing convention as sweep-entity-evidence.ts's local `hashContent`: sha256 over the
 * whitespace-collapsed, trimmed text, so re-running the collector over unchanged facts produces
 * an identical hash and a re-sweep can detect "nothing changed" without a full text diff. */
function hashContent(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/gu, ' ').trim()).digest('hex');
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value[0]!.toLowerCase() + value.slice(1);
}

function formatList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Synthesizes 2-4 short factual sentences from parsed table fields — never scraped verbatim text,
 * since the page carries none. Every clause traces to one labelled field, so a reviewer can check
 * any sentence against the same table a human would read on nces.ed.gov.
 *
 * `facts.address` has already had USPS directional abbreviations expanded (N -> North, etc — see
 * `expandDirectionalAbbreviations`), so it both reads naturally AND is independently corroborating:
 * the shared place-identity gate is checked against THIS text, built purely from NCES's own table,
 * not from anything the caller claims. That independence is deliberate — an earlier version of
 * this function took the caller's expected city/state as a parameter and wrote it directly into
 * the sentence, which made the downstream identity check tautological (it always "corroborated"
 * whatever was claimed, including a wrong state in testing). Keeping this function pure over
 * `CollegeNavigatorFacts` alone is what keeps that check meaningful.
 */
export function synthesizeNcesNarrative(facts: CollegeNavigatorFacts): string {
  const sentences: string[] = [];

  const typeDescriptor = [facts.level, facts.control ? lowerFirst(facts.control) : undefined]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(', ');
  const kind = typeDescriptor.length > 0 ? `a ${typeDescriptor} institution and ` : 'a ';
  sentences.push(
    `${facts.name} is ${kind}historically Black college or university located at ${facts.address}, according to the U.S. Department of Education's National Center for Education Statistics (NCES).`,
  );

  if (facts.awardsOffered.length > 0) {
    const awards = formatList(facts.awardsOffered.map((award) => lowerFirst(award)));
    sentences.push(`Degree and certificate levels offered include ${awards}.`);
  }

  const campusFacts: string[] = [];
  if (facts.studentPopulation !== undefined) {
    campusFacts.push(`a student population of ${facts.studentPopulation}`);
  }
  if (facts.studentFacultyRatio !== undefined) {
    campusFacts.push(`a student-to-faculty ratio of ${facts.studentFacultyRatio}`);
  }
  if (campusFacts.length > 0) {
    sentences.push(
      `As reported to NCES, ${facts.name} has ${formatList(campusFacts)}.`,
    );
  }

  if (facts.campusSetting !== undefined) {
    const housing =
      facts.campusHousing !== undefined
        ? facts.campusHousing.toLowerCase() === 'yes'
          ? ' and offers campus housing'
          : ' and does not offer campus housing'
        : '';
    sentences.push(`Its campus setting is classified as ${facts.campusSetting}${housing}.`);
  }

  return sentences.join(' ');
}

export type NcesEvidenceRow = {
  readonly entityId: string;
  readonly collector: 'nces-navigator';
  readonly sourceUrl: string;
  readonly sourceTier: 'tier1';
  readonly title: string;
  readonly contentText: string;
  readonly contentHash: string;
  readonly charCount: number;
  readonly qualityScore: number;
  readonly status: 'captured' | 'quarantined';
  readonly provenance: {
    readonly unitId: string;
    readonly rightsStatus: typeof NCES_RIGHTS_STATUS;
    readonly publisher: 'National Center for Education Statistics';
    readonly facts: CollegeNavigatorFacts;
    readonly identity: SubjectIdentity;
    readonly quality: QualityVerdict;
    readonly quarantineReason?: string;
  };
};

export type NcesLookupInput = {
  readonly entityId: string;
  readonly displayName: string;
  readonly city?: string;
  readonly county?: string;
  readonly state?: string;
  /** Injectable for tests; defaults to the real `safeFetchPage` (SSRF-safe outbound fetch). */
  readonly fetchPage?: (
    url: string,
    options?: { readonly allowedContentTypes?: readonly string[] },
  ) => Promise<SafeFetchedPage | undefined>;
};

/**
 * Fetches and parses the College Navigator page for an entity's UNITID, and — if the page
 * corroborates it as an HBCU — returns an evidence row (`captured` or `quarantined` depending on
 * text quality and the shared identity gate). Returns null only for the structural fail-closed
 * cases: entity_id doesn't carry a UNITID, the page couldn't be fetched, or
 * `parseCollegeNavigatorFacts` refused it (see that function's docs).
 *
 * Not wired into sweep-entity-evidence.ts's collection loop yet — that integration is reviewed
 * separately. This function's shape mirrors sweep-entity-evidence.ts's internal `EvidenceRow`
 * type (which is not exported) so wiring it in later is a straight pass-through.
 */
export async function collectNcesNavigatorEvidence(
  input: NcesLookupInput,
): Promise<NcesEvidenceRow | null> {
  const unitId = unitIdFromEntityId(input.entityId);
  if (unitId === null) return null;

  const url = navigatorUrl(unitId);
  const fetchPage = input.fetchPage ?? safeFetchPage;
  const page = await fetchPage(url, { allowedContentTypes: ['text/html'] });
  if (page === undefined) return null;

  const facts = parseCollegeNavigatorFacts(page.html, unitId);
  if (facts === null) return null;

  const narrative = synthesizeNcesNarrative(facts);
  const quality = assessText(narrative);
  const identity = checkSubjectIdentity(
    narrative,
    { displayName: input.displayName, city: input.city, county: input.county, state: input.state },
    { title: facts.name },
  );

  const status: 'captured' | 'quarantined' =
    quality.usable && identity.corroborated ? 'captured' : 'quarantined';
  const quarantineReason = !identity.corroborated ? identity.reason : quality.reason;

  return {
    entityId: input.entityId,
    collector: 'nces-navigator',
    sourceUrl: page.finalUrl,
    sourceTier: 'tier1',
    title: `NCES College Navigator — ${facts.name}`,
    contentText: narrative,
    contentHash: hashContent(narrative),
    charCount: narrative.length,
    qualityScore: quality.score,
    status,
    provenance: {
      unitId,
      rightsStatus: NCES_RIGHTS_STATUS,
      publisher: 'National Center for Education Statistics',
      facts,
      identity,
      quality,
      ...(status === 'quarantined' && quarantineReason !== undefined && { quarantineReason }),
    },
  };
}
