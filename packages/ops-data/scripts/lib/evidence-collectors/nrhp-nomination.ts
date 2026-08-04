/**
 * repo-n7p6.3 (WS3) — NRHP nomination form parsing.
 *
 * The National Register nomination form is the richest public-domain source we have for the
 * 2,578 template-only NRHP places in the released catalog, and it was never fetched. NPS
 * serves the scanned-and-OCR'd form at
 *   https://npgallery.nps.gov/NRHP/GetAsset/NRHP/<refnum>_text
 * (verified 2026-08-04: refnums 00000006 / 00000071 / 00000109 all return application/pdf,
 * 0.4-2.3 MB, with an extractable text layer).
 *
 * Only the CONTINUATION SHEETS carry narrative. The front pages are checkbox boilerplate, and
 * the two headings that sound useful ("Narrative Description", "Narrative Statement of
 * Significance") are followed on the form itself by nothing but the instruction to continue on
 * a separate sheet. So the parser targets continuation sheets, keyed by their section number:
 *
 *   Section 7 — physical description of the property
 *   Section 8 — statement of significance (the history: who, when, why it matters)
 *
 * Section 8 is the one worth publishing from; section 7 is kept because for many properties it
 * is where the builder, architect and construction date actually appear.
 *
 * Everything here is pure string work over already-extracted text, so the vintage-to-vintage
 * shape differences (NPS Form 10-900 from 1986 vs 1990 vs 1999) are unit-testable without
 * touching the network.
 */

/** Sections whose continuation-sheet prose is worth capturing, in output order. */
export const CAPTURED_SECTIONS = ['7', '8'] as const;
export type CapturedSection = (typeof CAPTURED_SECTIONS)[number];

export type NominationSection = {
  readonly section: string;
  readonly text: string;
};

/**
 * unpdf's `mergePages` output collapses page breaks but preserves intra-line spacing, and the
 * OCR itself emits ragged runs of spaces. Normalizing to single spaces first means every
 * pattern below can assume one space between tokens instead of `\s+` everywhere.
 */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r/gu, '\n')
    // U+00A0 (non-breaking), U+2007 (figure) and U+202F (narrow no-break) spaces all come
    // out of PDF text extraction and are invisible in an editor; fold them to a plain
    // space so the patterns below can assume ordinary whitespace.
    .replace(/[\t\u{a0}\u{2007}\u{202f}]/gu, ' ')
    // text extraction and are invisible in an editor; fold them to a plain space so the
    // patterns below can assume ordinary whitespace.
    .replace(/[\t\u{a0}\u{2007}\u{202f}]/gu, ' ')
    .replace(/[ ]{2,}/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Matches a continuation-sheet header and captures its section number. Two form vintages are
 * in circulation and both appear in the Black-heritage roster, so both are matched here rather
 * than in two code paths:
 *
 *   A. "CONTINUATION SHEET Section number 7 Page 1"
 *      "Section number _8_ Page _3_"      (typewriter forms fill the rules with underscores)
 *      "Section number  8   Page  12"
 *
 *   B. "Continuation Sheet Section 7-Description"
 *      "Continuation Sheet Section 8-Statement of Significance"
 *      (the 1990s district-nomination layout; refnum 00000071 has 18 of these and zero of A,
 *      which is why a Pattern-A-only parser returned no sections for it at all)
 *
 * The section token is a digit, optionally with a letter suffix ("8a"). Both alternatives
 * require a literal lead-in ("Section number", or "Section" immediately followed by a rule or
 * label separator) so a bare "8" in running prose can never open a section.
 */
const SECTION_HEADER_RE = new RegExp(
  [
    // A: "Section number 8 Page 3", rules and spacing tolerated.
    String.raw`Section\s+number\s*[_.\s—–-]*([0-9]{1,2}[a-z]?)\s*[_.\s—–-]*Page\s*[_.\s—–-]*(?:[0-9]{1,3}|[a-z]{1,3})?`,
    // B: "Section 8-Statement of Significance" — separator is required so that the label,
    // not just any digit, is what identifies the header.
    String.raw`Section\s+([0-9]{1,2}[a-z]?)\s*[—–-]\s*(?:Description|Statement of Significance|[A-Z][A-Za-z ]{2,40})`,
  ].join('|'),
  'giu',
);

/**
 * Boilerplate that repeats on every continuation sheet between the header and the prose, plus
 * the OMB/form-number furniture. Stripped so the captured text is narrative rather than the
 * same 30 words of federal letterhead multiplied by page count.
 */
const SHEET_BOILERPLATE: readonly RegExp[] = [
  /(?:NPS|NFS|NP5)\s*Form\s*10-900[-a-z]*/giu,
  /OMB\s*(?:No\.?|Approval\s*No\.?)\s*[0-9-]+/giu,
  /United States Department of the Interior/giu,
  /National Park Service/giu,
  /NATIONAL REGISTER OF HISTORIC PLACES/giu,
  /CONTINUATION SHEET/giu,
  /\(\s*(?:Rev\.|Oct\.|8-86|Rev\. 10-90)[^)]*\)/giu,
];

function stripBoilerplate(text: string): string {
  let out = text;
  for (const pattern of SHEET_BOILERPLATE) out = out.replace(pattern, ' ');
  return out.replace(/[ ]{2,}/gu, ' ').trim();
}

/**
 * Split normalized nomination text into continuation-sheet sections.
 *
 * A section's text runs from the end of its header to the start of the next header. The same
 * section number appears once per page, so pages of one section are concatenated in document
 * order — which is what we want, since a statement of significance routinely runs 5-20 pages.
 */
export function splitNominationSections(normalizedText: string): readonly NominationSection[] {
  const headers: { section: string; start: number; end: number }[] = [];
  SECTION_HEADER_RE.lastIndex = 0;
  let match = SECTION_HEADER_RE.exec(normalizedText);
  while (match !== null) {
    // Group 1 is Pattern A's section number, group 2 is Pattern B's; exactly one is defined.
    const section = match[1] ?? match[2];
    if (section !== undefined) {
      headers.push({
        section: section.toLowerCase(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    match = SECTION_HEADER_RE.exec(normalizedText);
  }
  if (headers.length === 0) return [];

  const bySection = new Map<string, string[]>();
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]!;
    const sliceEnd = i + 1 < headers.length ? headers[i + 1]!.start : normalizedText.length;
    const body = stripBoilerplate(normalizedText.slice(header.end, sliceEnd));
    if (body.length === 0) continue;
    const existing = bySection.get(header.section);
    if (existing) existing.push(body);
    else bySection.set(header.section, [body]);
  }

  return [...bySection.entries()]
    .map(([section, parts]) => ({ section, text: parts.join('\n\n') }))
    .sort((a, b) => a.section.localeCompare(b.section, 'en'));
}

/**
 * Each continuation sheet repeats the property name and "County and State" line under the
 * header. Once sections are joined across pages that line recurs every page-length of prose;
 * dropping repeats of the known property name keeps the captured text readable and stops the
 * model from treating the repetition as emphasis.
 */
export function dropRepeatedPropertyHeader(text: string, displayName: string): string {
  const name = displayName.trim();
  if (name.length < 4) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return text
    .replace(new RegExp(`${escaped}\\s*,?\\s*(?:Name of Property)?`, 'giu'), ' ')
    .replace(/Name of Property|County and State/giu, ' ')
    .replace(/[ ]{2,}/gu, ' ')
    .trim();
}

export type ParsedNomination = {
  readonly sections: readonly NominationSection[];
  /** Sections 7 + 8 joined, boilerplate and repeated headers removed. Empty when neither found. */
  readonly narrative: string;
  readonly hasSignificance: boolean;
};

export function parseNomination(rawText: string, displayName: string): ParsedNomination {
  const normalized = normalizeExtractedText(rawText);
  const sections = splitNominationSections(normalized);
  const captured = CAPTURED_SECTIONS.map((wanted) =>
    sections.find((section) => section.section === wanted),
  ).filter((section): section is NominationSection => section !== undefined);

  const narrative = captured
    .map((section) => dropRepeatedPropertyHeader(section.text, displayName))
    .filter((text) => text.length > 0)
    .join('\n\n');

  return {
    sections,
    narrative,
    hasSignificance: captured.some((section) => section.section === '8'),
  };
}

/**
 * Identity corroboration for a fetched nomination.
 *
 * Fetching by refnum is not self-verifying. Refnum 00000109 is "Castle Rock" in the NPS
 * authoritative layer and in our roster, but the nomination form served at that refnum is
 * titled "Dr. A. Porter Davis Residence" — same county, same state, one property carrying two
 * names. That case is benign, but it is indistinguishable at fetch time from the case we must
 * never ship: the wrong property's history attached to an entity under a federal citation.
 *
 * So place agreement is the gate and name agreement is only a signal. A document that does not
 * mention the expected state AND county is refused outright. A document that agrees on place
 * but not on name is captured and flagged `nameMismatch` for adjudication — recorded as a lead
 * for review, never silently treated as confirmed.
 */
export type NominationIdentity = {
  readonly stateMatch: boolean;
  readonly countyMatch: boolean;
  readonly nameMatch: boolean;
  /** False when place does not corroborate — caller must quarantine rather than store. */
  readonly placeCorroborated: boolean;
  readonly nameMismatch: boolean;
};

/** Roster names are inverted for filing ("Jude, George, House"); compare on the bare tokens. */
function significantNameTokens(displayName: string): readonly string[] {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gu, ' ')
    .split(/\s+/u)
    .filter(
      (token) =>
        token.length > 3 &&
        !['house', 'historic', 'district', 'building', 'site', 'the', 'and'].includes(token),
    );
}

export function checkNominationIdentity(
  narrative: string,
  expected: { readonly displayName: string; readonly state?: string; readonly county?: string },
): NominationIdentity {
  const haystack = narrative.toLowerCase();
  const state = expected.state?.trim().toLowerCase();
  const county = expected.county?.trim().toLowerCase();

  const stateMatch = state !== undefined && state.length > 0 ? haystack.includes(state) : false;
  const countyMatch = county !== undefined && county.length > 0 ? haystack.includes(county) : false;

  const tokens = significantNameTokens(expected.displayName);
  // Majority of distinctive name tokens present. A district nomination mentions its own name
  // dozens of times, so a genuine match is never marginal.
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  const nameMatch = tokens.length === 0 ? false : hits / tokens.length >= 0.5;

  // Both place fields when we have both; if the roster only gave one, that one must match.
  const placeCorroborated =
    state !== undefined && county !== undefined && state.length > 0 && county.length > 0
      ? stateMatch && countyMatch
      : stateMatch || countyMatch;

  return {
    stateMatch,
    countyMatch,
    nameMatch,
    placeCorroborated,
    nameMismatch: placeCorroborated && !nameMatch,
  };
}

/** NPS asset URL carrying the OCR'd text layer of the nomination form for a refnum. */
export function nominationTextUrl(refnum: string): string {
  if (!/^[0-9]{8}$/u.test(refnum)) {
    throw new Error(`Refnum must be 8 digits, got: ${refnum}`);
  }
  return `https://npgallery.nps.gov/NRHP/GetAsset/NRHP/${refnum}_text`;
}
