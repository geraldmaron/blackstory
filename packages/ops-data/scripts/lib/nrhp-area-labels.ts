/**
 * Shared NPS registry-code labels and deterministic listing/significance formatters. Unknown
 * codes receive a warning and generic title-cased fallback. Use one mapping for template
 * generation and publication so raw codes do not leak through divergent paths.
 */

/**
 * Re-exports domain-owned template signatures used by both summary generation and coverage
 * classification.
 */
export { NRHP_SUMMARY_TRAILER, NRHP_SUMMARY_FILLER, LANE_TEMPLATE_SIGNATURES } from '@repo/domain';

/** Raw NPS area-of-significance code (already trimmed, upper-cased) -> lowercase human phrase
 *  for mid-sentence use ("for its significance in X, Y, and Z"). `null` drops the code entirely
 *  — either too NPS-internal to read as a public "significance" (e.g. a negatively-defined
 *  archaeology bucket) or too vague to say anything (`OTHER`). */
const AREA_LABELS: Readonly<Record<string, string | null>> = {
  AGRICULTURE: 'agriculture',
  ARCHEOLOGY: 'archeology',
  'ARCHEOLOGY-HISTORIC ABORIGINAL': 'historic-period Indigenous archeology',
  'ARCHEOLOGY-HISTORIC NON-ABORIGINAL': 'historic-period archeology',
  'ARCHEOLOGY-PREHISTORIC': 'prehistoric archeology',
  ARCHITECTURE: 'architecture',
  ART: 'art',
  ASIAN: 'Asian American heritage',
  BLACK: 'Black heritage',
  COMMERCE: 'commerce',
  COMMUNICATIONS: 'communications',
  'COMMUNITY PLANNING AND DEVELOPMENT': 'community planning and development',
  CONSERVATION: 'conservation',
  ECONOMICS: 'economics',
  EDUCATION: 'education',
  ENGINEERING: 'engineering',
  'ENTERTAINMENT/RECREATION': 'entertainment and recreation',
  'ETHNIC HERITAGE': 'ethnic heritage',
  'ETHNIC HERITAGE-ASIAN': 'Asian American heritage',
  'ETHNIC HERITAGE-BLACK': 'Black heritage',
  'ETHNIC HERITAGE-EUROPEAN': 'European American heritage',
  'ETHNIC HERITAGE-HISPANIC': 'Hispanic heritage',
  'ETHNIC HERITAGE-NATIVE AMERICAN': 'Native American heritage',
  'ETHNIC HERITAGE-OTHER-ETHNIC': 'ethnic heritage',
  'ETHNIC HERITAGE-PACIFIC ISLANDER': 'Pacific Islander heritage',
  EUROPEAN: 'European American heritage',
  'EXPLORATION/SETTLEMENT': 'exploration and settlement',
  'HEALTH/MEDICINE': 'health and medicine',
  HISPANIC: 'Hispanic heritage',
  'HISTORIC - ABORIGINAL': 'Indigenous history',
  'HISTORIC - NON-ABORIGINAL': null,
  INDUSTRY: 'industry',
  INVENTION: 'invention',
  'LANDSCAPE ARCHITECTURE': 'landscape architecture',
  LAW: 'law',
  LITERATURE: 'literature',
  'MARITIME HISTORY': 'maritime history',
  MILITARY: 'military history',
  'NATIVE AMERICAN': 'Native American heritage',
  OTHER: null,
  'OTHER-ETHNIC': 'ethnic heritage',
  'PACIFIC-ISLANDER': 'Pacific Islander heritage',
  'PERFORMING ARTS': 'performing arts',
  'POLITICS/GOVERNMENT': 'politics and government',
  PREHISTORIC: 'prehistoric archeology',
  RELIGION: 'religion',
  SCIENCE: 'science',
  'SOCIAL HISTORY': 'social history',
  TRANSPORTATION: 'transportation',
};

const unknownCodesWarned = new Set<string>();

/** Generic fallback for a code not (yet) in `AREA_LABELS`: lowercase, slash/hyphen joins read
 *  as "and"/space rather than leaking the raw punctuation into prose. */
function fallbackLabel(key: string): string {
  return key
    .toLowerCase()
    .replaceAll('/', ' and ')
    .replaceAll('-', ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ');
}

/** One raw code -> human phrase, or `null` to drop it from the significance list. Unmapped codes
 *  log a warning (once per code per process) and fall back to a generic rendering. */
export function humanizeAreaCode(rawEntry: string): string | null {
  const key = rawEntry.trim().toUpperCase();
  if (key.length === 0) return null;
  if (key in AREA_LABELS) return AREA_LABELS[key] ?? null;
  if (!unknownCodesWarned.has(key)) {
    unknownCodesWarned.add(key);
    console.warn(
      `[nrhp-area-labels] unmapped areaOfSignificance code, using generic fallback: "${key}"`,
    );
  }
  return fallbackLabel(key);
}

/** "EDUCATION; BLACK; ARCHITECTURE" -> "education, Black heritage, and architecture". Drops
 *  codes that map to `null` (e.g. "HISTORIC - NON-ABORIGINAL"); falls back to
 *  "African American heritage" when every code drops out or the input is empty. */
export function humanizeAreas(raw: string | undefined): string {
  const parts = (raw ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => humanizeAreaCode(entry))
    .filter((label): label is string => label !== null && label.length > 0);
  if (parts.length === 0) return 'African American heritage';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Detects raw registry vocabulary in both generated and drafted prose. Narrow casing and
 * parenthesis rules avoid rejecting ordinary historical language. Exact quotation matching
 * alone cannot catch inappropriate registry jargon.
 */
export const RAW_REGISTRY_VOCABULARY_PATTERNS: readonly RegExp[] = [
  /ethnic heritage \(black\)/iu,
  /ETHNIC HERITAGE[-\s]/u,
  /NON-ABORIGINAL/u,
  /OTHER-ETHNIC/u,
  /ENTERTAINMENT\/RECREATION/u,
];

/** Which raw-registry patterns (by source) `text` trips; empty when the text is clean. */
export function findRawRegistryVocabulary(text: string | null | undefined): readonly string[] {
  if (!text) return [];
  return RAW_REGISTRY_VOCABULARY_PATTERNS.filter((pattern) => pattern.test(text)).map(
    (pattern) => pattern.source,
  );
}

/** Pure — Excel/NPS serial date (days since 1899-12-30) -> "Month D, YYYY". */
export function formatNrhpListedDate(serial: string | null | undefined): string | null {
  if (!serial) return null;
  const days = Number.parseInt(serial, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + days * 86_400_000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * The listing-FACT claim object (pairs with the `predicate: 'listing'` category label — see
 * `buildReleaseSourceFromLandscape`) — a lowercase-leading FRAGMENT, e.g. "on the National
 * Register of Historic Places on July 30, 1971, reference #71000836", matching every other
 * predicate/object pair's shape in this codebase. `packages/domain/src/publication/
 * release-builder.ts`'s `formatClaimInclusionNote` — the single renderer every user-visible claim
 * display goes through (entity page, notabilityBasis note) — builds the sentence by title-casing
 * the predicate and prepending it to the object: `${Predicate} ${object}.`. A full sentence here
 * ("Listed on the National Register...") collided with that prefix and rendered as "Listing
 * Listed on the National Register..."; a fragment reads as "Listing on the National Register of
 * Historic Places on July 30, 1971, reference #71000836." — one clause, not two. Never the
 * descriptive summary prose: this is the raw registration fact, reused verbatim nowhere else in
 * the entity's public text.
 */
export function buildNrhpListingFactObject(payload: {
  readonly refnum?: string | undefined;
  readonly listedDateSerial?: string | null | undefined;
}): string {
  const date = formatNrhpListedDate(payload.listedDateSerial);
  const refnum = (payload.refnum ?? '').trim();
  const datePart = date ? ` on ${date}` : '';
  const refPart = refnum.length > 0 ? `, reference #${refnum}` : '';
  return `on the National Register of Historic Places${datePart}${refPart}`;
}

/**
 * The significance claim-object fragment (pairs with a `predicate: 'significant for'` verb
 * phrase, e.g. "Significant for Black heritage and architecture." once
 * `buildNotabilityBasisNote` prefixes the predicate) — e.g. "Black heritage and architecture".
 * Drives `notabilityBasis[0].note` once `buildReleaseNotabilityBasis` derives it from this claim
 * — distinct text from both the summary and the listing-fact claim object above.
 */
export function buildNrhpSignificanceObject(payload: {
  readonly areaOfSignificance?: string | undefined;
}): string {
  return humanizeAreas(payload.areaOfSignificance);
}
