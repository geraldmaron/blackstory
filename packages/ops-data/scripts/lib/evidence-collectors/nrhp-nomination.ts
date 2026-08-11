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

import { checkPlaceIdentity, significantNameTokens } from './subject-identity.ts';

/** Sections whose continuation-sheet prose is worth capturing. */
export const CAPTURED_SECTIONS = ['7', '8'] as const;
export type CapturedSection = (typeof CAPTURED_SECTIONS)[number];

/**
 * The order the captured sections are JOINED into `narrative` — significance FIRST.
 *
 * This is not cosmetic. Everything downstream reads a truncated prefix of this text: the
 * enrichment harness gives a model the first 4,000 characters of each source
 * (MAX_CHARS_PER_SOURCE). Joined in section order, that prefix is section 7 — the physical
 * description of the building's fabric — and section 8, the statement of significance, is the
 * part that gets cut.
 *
 * Measured 2026-08-11 across the captured corpus: 361 of 368 nominations exceed the window, all
 * 288 that carry both sections are truncated, and the median nomination loses 18,893 characters
 * (max 415,762). So essentially every record was being drafted from cornice profiles and window
 * sash while the history sat just past the cutoff. It is exactly what the drafters kept reporting
 * as "the nomination excerpt is purely architectural" — including for a district in Neshoba
 * County, Mississippi.
 *
 * Section 7 still follows, because it is where builders, architects and construction dates
 * appear. It is simply no longer what a reader of the first 4,000 characters gets.
 */
export const NARRATIVE_SECTION_ORDER = ['8', '7'] as const;

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
  return (
    raw
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
      .trim()
  );
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

/**
 * Fallback segmentation by narrative heading, for forms whose continuation-sheet table is
 * destroyed by OCR (repo-n7p6.12).
 *
 * The header-based split above depends on reading a section NUMBER out of the form's little
 * table. On many scans that number is the first thing OCR loses, because it sits alone in a
 * ruled box: refnum 00000534 yields "Section number Z — Page — I —", 00000793 yields
 * "Section number Page" with both values gone and sometimes "Continuation Sheet 7 3 Section
 * number Page" with the values landing BEFORE their own labels. Meanwhile refnum 00000261 (a
 * Registration Form paginated straight through) has no section table at all — just "Page 2".
 *
 * What survives in every one of those is the narrative heading printed in the body text:
 * "7. DESCRIPTION", "8. STATEMENT OF SIGNIFICANCE", "9. MAJOR BIBLIOGRAPHICAL REFERENCES".
 * Those are set in ordinary running text rather than in a ruled box, so OCR keeps them.
 *
 * The headings appear twice: once on the front form (where they label an empty box that says
 * "continue on a separate sheet") and again where the actual prose begins. So the LAST
 * occurrence is the one that opens real narrative, and the section ends at the next
 * higher-numbered heading after it, or at end of document.
 */
const NARRATIVE_HEADINGS: readonly { readonly section: string; readonly pattern: RegExp }[] = [
  {
    section: '7',
    pattern: /(?:\b7\s*[.)]\s*(?:NARRATIVE\s+)?DESCRIPTION|NARRATIVE\s+DESCRIPTION)/giu,
  },
  {
    section: '8',
    pattern:
      /(?:\b8\s*[.)]\s*(?:NARRATIVE\s+)?STATEMENT\s+OF\s+SIGNIFICANCE|NARRATIVE\s+STATEMENT\s+OF\s+SIGNIFICANCE|STATEMENT\s+OF\s+SIGNIFICANCE)/giu,
  },
  {
    section: '9',
    pattern: /(?:\b9\s*[.)]\s*MAJOR\s+BIBLIOGRAPH|MAJOR\s+BIBLIOGRAPHICAL)/giu,
  },
];

/** A heading opening less than this much text is a form label, not the start of narrative. */
const MIN_FALLBACK_SECTION_CHARS = 600;

export function splitByNarrativeHeadings(normalizedText: string): readonly NominationSection[] {
  const starts = new Map<string, number[]>();
  for (const { section, pattern } of NARRATIVE_HEADINGS) {
    pattern.lastIndex = 0;
    const positions: number[] = [];
    let match = pattern.exec(normalizedText);
    while (match !== null) {
      positions.push(match.index + match[0].length);
      match = pattern.exec(normalizedText);
    }
    starts.set(section, positions);
  }

  const sections: NominationSection[] = [];
  for (const wanted of CAPTURED_SECTIONS) {
    const positions = starts.get(wanted) ?? [];
    if (positions.length === 0) continue;
    const begin = positions[positions.length - 1]!;

    // End at the earliest heading of a HIGHER section that starts after this one. Lower and
    // equal numbers are skipped: a repeated "8. Statement" is the same section continuing on
    // the next sheet, not a boundary.
    let end = normalizedText.length;
    for (const [section, sectionStarts] of starts) {
      if (section.localeCompare(wanted, 'en') <= 0) continue;
      for (const start of sectionStarts) {
        if (start > begin && start < end) end = start;
      }
    }

    const text = stripBoilerplate(normalizedText.slice(begin, end));
    if (text.length >= MIN_FALLBACK_SECTION_CHARS) sections.push({ section: wanted, text });
  }
  return sections;
}

/**
 * Which strategy actually produced the sections. Recorded on the evidence row so a later pass
 * can tell whether a capture came from the form's own section table or from the looser
 * heading-based fallback, without re-parsing the document.
 */
export type SectionSegmentation = 'section-table' | 'narrative-headings' | 'none';

export type ParsedNomination = {
  readonly sections: readonly NominationSection[];
  /** Sections 7 + 8 joined, boilerplate and repeated headers removed. Empty when neither found. */
  readonly narrative: string;
  readonly hasSignificance: boolean;
  readonly segmentation: SectionSegmentation;
};

export function parseNomination(rawText: string, displayName: string): ParsedNomination {
  const normalized = normalizeExtractedText(rawText);
  const headerSections = splitNominationSections(normalized);
  const pick = (from: readonly NominationSection[]): readonly NominationSection[] =>
    CAPTURED_SECTIONS.map((wanted) => from.find((section) => section.section === wanted)).filter(
      (section): section is NominationSection => section !== undefined,
    );

  // Prefer the section table; fall back to narrative headings when OCR destroyed it. 21 of the
  // first 100 forms swept had 18k-158k characters of perfectly good text and no readable
  // section table at all (repo-n7p6.12), so the fallback is the difference between capturing
  // that history and discarding it.
  let sections = headerSections;
  let captured = pick(headerSections);
  let segmentation: SectionSegmentation = captured.length > 0 ? 'section-table' : 'none';
  if (captured.length === 0) {
    const fallback = splitByNarrativeHeadings(normalized);
    const fallbackCaptured = pick(fallback);
    if (fallbackCaptured.length > 0) {
      sections = fallback;
      captured = fallbackCaptured;
      segmentation = 'narrative-headings';
    }
  }

  // Significance first — see NARRATIVE_SECTION_ORDER. `captured` is in section order because
  // that is what `pick` produces and what `sectionsFound` reports; only the joined prose is
  // reordered, so nothing else downstream changes meaning.
  const narrative = NARRATIVE_SECTION_ORDER.map((wanted) =>
    captured.find((section) => section.section === wanted),
  )
    .filter((section): section is NominationSection => section !== undefined)
    .map((section) => dropRepeatedPropertyHeader(section.text, displayName))
    .filter((text) => text.length > 0)
    .join('\n\n');

  return {
    sections,
    narrative,
    hasSignificance: captured.some((section) => section.section === '8'),
    segmentation,
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
  readonly cityMatch: boolean;
  readonly nameMatch: boolean;
  /** False when place does not corroborate — caller must quarantine rather than store. */
  readonly placeCorroborated: boolean;
  readonly nameMismatch: boolean;
};

export function checkNominationIdentity(
  /**
   * The WHOLE extracted document, not just the narrative we keep. Identity is a property of the
   * document; the narrative is only the excerpt worth publishing from. Checking the excerpt
   * quarantined two real documents in the first batch, because the county is printed on the
   * front form ("Fulton" appears twice in the Herndon Home nomination, both times outside
   * sections 7 and 8) while the narrative names only the city.
   */
  documentText: string,
  expected: {
    readonly displayName: string;
    readonly state?: string;
    readonly county?: string;
    readonly city?: string;
  },
): NominationIdentity {
  // The place rule lives in subject-identity.ts, shared with the searched-document collectors —
  // one implementation, so a fix to "Covington VA is not Covington KY" reaches every collector.
  const place = checkPlaceIdentity(documentText, expected);

  const haystack = documentText.toLowerCase();
  const tokens = significantNameTokens(expected.displayName);
  // Majority of distinctive name tokens present. A district nomination mentions its own name
  // dozens of times, so a genuine match is never marginal.
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  const nameMatch = tokens.length === 0 ? false : hits / tokens.length >= 0.5;

  return {
    stateMatch: place.stateMatch,
    countyMatch: place.countyMatch,
    cityMatch: place.cityMatch,
    nameMatch,
    placeCorroborated: place.placeCorroborated,
    nameMismatch: place.placeCorroborated && !nameMatch,
  };
}

/**
 * A National Register reference number, as NPS actually issues them.
 *
 * Eight digits for the historic series (71000836), NINE for the modern one — NPS moved to a
 * 100000000-block sequence for newer listings, and 100002883 is a perfectly ordinary refnum.
 *
 * This started as an 8-digit-only rule and that quietly starved the newest listings of the richest
 * source in the corpus. Measured in the nrhp-black-heritage lane: 695 entities carry a 9-digit
 * refnum, and the nomination collector had never once been attempted on any of them — 485 sat at
 * status='skipped' having been rejected here before a single fetch. Only 2 of those 695 were ever
 * enriched, against 203 of the 1,855 8-digit rows. Verified against NPGallery that the modern
 * refnums serve full nomination PDFs (5-6 MB, larger than the 8-digit forms), so the exclusion was
 * costing real documents, not filtering absent ones.
 *
 * Range rather than an exact length, so the next series NPS issues is a data question rather than
 * another silent starvation.
 */
const REFNUM_PATTERN = /^[0-9]{8,9}$/u;

export function isUsableRefnum(refnum: string | undefined): refnum is string {
  return refnum !== undefined && REFNUM_PATTERN.test(refnum);
}

/** NPS asset URL carrying the OCR'd text layer of the nomination form for a refnum. */
export function nominationTextUrl(refnum: string): string {
  if (!isUsableRefnum(refnum)) {
    throw new Error(`Refnum must be 8 or 9 digits, got: ${refnum}`);
  }
  return `https://npgallery.nps.gov/NRHP/GetAsset/NRHP/${refnum}_text`;
}
