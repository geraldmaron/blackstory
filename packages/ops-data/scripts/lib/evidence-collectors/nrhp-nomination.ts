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
 *      "CONTINUATION SHEET Section number 8 Woodland-Scarboro Historic District"
 *      The trailing "Page N" is OPTIONAL. On the 1991 layout the property name is printed where
 *      the page rule sits, so there is no "Page" token to anchor on at all — refnum 91001106 has
 *      10 of these and a Page-mandatory pattern matched none of them. It then fell through to
 *      the heading fallback, which had nothing to work with but the cover sheet, and captured
 *      698 characters of certification language out of a 96,416-character document.
 *      Dropping the requirement is safe because "Section number" is itself a form label that
 *      does not occur in running prose; the digit alone was never what carried the precision.
 *
 *   B. "Continuation Sheet Section 7-Description"
 *      "Continuation Sheet Section 8-Statement of Significance"
 *      (the 1990s district-nomination layout; refnum 00000071 has 18 of these and zero of A,
 *      which is why a Pattern-A-only parser returned no sections for it at all)
 *
 *   C. "Continuation sheet Item number 7 OMB No. 1024-0018 Page 2"
 *      NPS Form 10-900 (3-82), the "Inventory-Nomination Form". This vintage numbers its
 *      continuation sheets by ITEM rather than by SECTION, so neither A nor B matched a single
 *      header on it and the parser returned zero sections for the whole document.
 *
 *   D. "Section 8 Page _9"
 *      The 10-900 Registration Form as printed since the late 1990s drops the word "number"
 *      from its continuation-sheet header. A requires "number", B requires a dash and a label,
 *      C requires "Item" — so none of them matched, the section table came back without the
 *      sheets carrying the narrative, and the heading fallback then took the only "Statement of
 *      Significance" left on the front form: the criteria checkbox block.
 *
 *      That failure is quiet and it is the expensive kind, because the front form of this
 *      vintage says in as many words "Explain the significance of the property on one or more
 *      continuation sheets" — so on exactly these documents the entire statement of
 *      significance lives on the sheets that were being missed. Refnum 07001083 (Harriet M.
 *      Cornwell Tourist House) is the measured example: a 33,026-character nomination whose
 *      section 8 came back as 1,487 characters of checkbox glyphs, while the real narrative —
 *      "its role in the practice of segregation in Columbia, South Carolina from ca. 1940 to
 *      ca. 1960", and eight mentions of the Green Book — sat unread from character 19,580 on.
 *      `hasSignificance` was true the whole time, so nothing downstream had any reason to look.
 *
 * The section token is a digit, optionally with a letter suffix ("8a"). Every alternative
 * requires a literal form label as its lead-in ("Section number", "Item number", or "Section"
 * immediately followed by a rule or label separator) so a bare "8" in running prose can never
 * open a section. D keeps that guarantee with a different label: it drops "number" but makes
 * the "Page" rule MANDATORY, so the pair "Section <n> Page" is still two form labels bracketing
 * the digit rather than a bare number in prose.
 */
/**
 * The NPS nomination form numbers its items 1 through 13 and no further. Constraining the
 * capture to that range is what makes the optional page rule safe: without it, "Section number"
 * followed by any one or two digits matched photo-log captions and OCR debris. Refnum 88003348
 * came back segmented into sections 18, 21, 32, 33, 38, 55, 69, 75 and 82, each spurious header
 * truncating the real section it landed inside.
 */
// The trailing lookahead is load-bearing: without it "Section number 55" matches its leading
// "5" and opens a spurious section 5, and "Section number 133" opens a spurious 13.
const SECTION_TOKEN = String.raw`(1[0-3]|[1-9])(?![0-9])[a-z]?`;

const SECTION_HEADER_RE = new RegExp(
  [
    // A: "Section number 8 Page 3" / "Section number 8 <property name>", rules and spacing
    // tolerated, the page rule optional.
    String.raw`Section\s+number\s*[_.\s—–-]*${SECTION_TOKEN}(?:\s*[_.\s—–-]*Page\s*[_.\s—–-]*(?:[0-9]{1,3}|[a-z]{1,3})?)?`,
    // B: "Section 8-Statement of Significance" — separator is required so that the label,
    // not just any digit, is what identifies the header.
    String.raw`Section\s+${SECTION_TOKEN}\s*[—–-]\s*(?:Description|Statement of Significance|[A-Z][A-Za-z ]{2,40})`,
    // C: "Item number 7" — the 3-82 Inventory-Nomination Form.
    String.raw`Item\s+number\s*[_.\s—–-]*${SECTION_TOKEN}`,
    // D: "Section 8 Page _9" — the modern Registration Form's sheet header, without "number".
    // Unlike A the page rule is REQUIRED: "number" is what makes A's digit safe, and "Page" is
    // what makes D's digit safe. Drop both and "Section 8" matches running prose.
    String.raw`Section\s*[_.\s—–-]*${SECTION_TOKEN}\s*[_.\s—–-]*Page\s*[_.\s—–-]*(?:[0-9]{1,3}|[a-z]{1,3})?`,
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
    // One capture group per vintage (A, B, C, D); exactly one is defined on any given match.
    // Read them by scanning rather than by index: the alternatives are numbered by their order
    // in SECTION_HEADER_RE, so a hard-coded list silently ignores whichever vintage is added
    // last — the new pattern matches, its group is never read, and the header is dropped.
    const section = match.slice(1).find((group) => group !== undefined);
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
 * CHOOSING AMONG OCCURRENCES. A heading appears several times in one document, and picking the
 * wrong instance is the difference between history and letterhead. This used to take the LAST
 * occurrence, on the reasoning that the front form's copy comes first. That is wrong in two
 * ways, and both were costing real narrative:
 *
 *   1. Many scans append a BLANK copy of the form after the filled one. Its
 *      "Statement of Significance (in one paragraph)" is followed by the empty checklist
 *      ("summary paragraph, completeness, clarity, applicable criteria...") and then, a couple
 *      of hundred characters later, by the blank "9. Major Bibliographical References". So the
 *      last occurrence opens a section too short to survive MIN_FALLBACK_SECTION_CHARS, the
 *      candidate was dropped, and the section was lost entirely rather than taken from the
 *      earlier, filled instance. Refnum 85000186 (Freedmen's Town) has four occurrences: two
 *      real ones at 130k and 134k, two blank ones at 220k. The document is 696,543 characters
 *      and it captured 700 of them, all checkbox glyphs.
 *   2. On some layouts the only occurrence is the cover sheet's certification block
 *      ("Certifying official has considered the significance of this property..."), which runs
 *      a few hundred characters into "9. Major Bibliographical References".
 *
 * So the rule is still "latest wins", but it now SKIPS rather than accepts: an occurrence is
 * rejected when what follows it is recognizably form furniture, and rejected when the text it
 * opens is too short to be narrative — and in both cases the search continues to the next
 * occurrence back instead of abandoning the section.
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

/**
 * How much text after a heading is inspected to decide whether it opens prose or the blank
 * form. Long enough to clear the heading's own trailing words, short enough that a real
 * narrative's opening sentences dominate the sample.
 */
const CANDIDATE_PROBE_CHARS = 400;

/**
 * The blank form's own review checklist, printed under "Statement of Significance" on the empty
 * template that many scans bind in after the filled one. These labels do not appear under the
 * heading on a completed form, so finding them is proof the heading opens the template.
 *
 * DELIBERATELY NARROW. A first version of this check also rejected candidates opening with
 * "Certifying official has considered", "See continuation sheet", or a high density of orphan
 * single characters. Backtested over 1,159 documents that cost 43 records their statement of
 * significance and shrank 111 others: the modern 10-900 Registration Form genuinely opens its
 * section 8 with "Applicable National Register Criteria (Mark 'x' in one or more boxes...)",
 * which is checkbox-dense and entirely legitimate. Rejecting a real heading is far more
 * expensive than accepting a blank one, because the blank one is caught anyway by
 * MIN_FALLBACK_SECTION_CHARS — the template's checklist runs only a couple of hundred
 * characters before the blank "9. Major Bibliographical References" closes it.
 */
const BLANK_TEMPLATE_CHECKLIST: readonly RegExp[] = [
  /justification\s+of\s+areas\s+checked/iu,
  /relating\s+significance\s+to\s+the\s+resource/iu,
  /relationship\s+of\s+integrity\s+to\s+significance/iu,
  /justification\s+of\s+exception/iu,
];

/**
 * NOT in the list above, though it looks like it belongs: "Certifying official has considered".
 * On many forms that certification block sits on the same page as, and immediately before, the
 * real statement of significance, so rejecting it costs 35 documents their section 8 and shrinks
 * 32 more. Measured, not assumed. The one document it would have helped (refnum 91000269, Bethel
 * A.M.E. Church) is left as a known miss rather than paying that price.
 */

/** True when the text opening a heading is the blank template's checklist, not narrative. */
function opensFormFurniture(probe: string): boolean {
  return BLANK_TEMPLATE_CHECKLIST.some((pattern) => pattern.test(probe));
}

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

  // End at the earliest heading of a HIGHER section that starts after this one. Lower and
  // equal numbers are skipped: a repeated "8. Statement" is the same section continuing on
  // the next sheet, not a boundary.
  const endFor = (wanted: string, begin: number): number => {
    let end = normalizedText.length;
    for (const [section, sectionStarts] of starts) {
      if (section.localeCompare(wanted, 'en') <= 0) continue;
      for (const start of sectionStarts) {
        if (start > begin && start < end) end = start;
      }
    }
    return end;
  };

  const sections: NominationSection[] = [];
  for (const wanted of CAPTURED_SECTIONS) {
    const positions = starts.get(wanted) ?? [];
    // Latest first. An earlier occurrence's span subsumes every later one (equal-numbered
    // headings do not bound a section, so that a statement continuing across sheets is not
    // truncated at the sheet break), which is exactly why "the longest span" is NOT the rule
    // here: it would always resolve to the first occurrence, i.e. the front form's label.
    for (let i = positions.length - 1; i >= 0; i -= 1) {
      const begin = positions[i]!;
      if (opensFormFurniture(normalizedText.slice(begin, begin + CANDIDATE_PROBE_CHARS))) continue;
      const text = stripBoilerplate(normalizedText.slice(begin, endFor(wanted, begin)));
      // Keep looking rather than giving up. Dropping the section on the first short candidate
      // is what lost Freedmen's Town: its last two occurrences are the blank form, 253
      // characters apart, and the two filled ones 90k characters earlier were never reached.
      if (text.length < MIN_FALLBACK_SECTION_CHARS) continue;
      sections.push({ section: wanted, text });
      break;
    }
  }
  return sections;
}

/**
 * Which strategy actually produced the sections. Recorded on the evidence row so a later pass
 * can tell whether a capture came from the form's own section table or from the looser
 * heading-based fallback, without re-parsing the document.
 */
export type SectionSegmentation = 'section-table' | 'narrative-headings' | 'mixed' | 'none';

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
  //
  // The choice is PER SECTION and it is decided on evidence, not on a fixed preference for the
  // table. Two failures forced this, both measured over the whole captured corpus:
  //
  //   1. All-or-nothing hid statements of significance. The 3-82 Inventory-Nomination Form
  //      often carries a continuation sheet for item 7 and none for item 8, because its
  //      significance runs on the front form under "Statement of Significance (in one
  //      paragraph)". A document-level strategy saw section 7 in the table, declared success,
  //      and never asked the fallback for section 8 — capturing the building's fabric and
  //      dropping its history, which is the one thing this corpus is for.
  //   2. A table that reads only SOME of its sheets slices the section from the wrong sheet.
  //      Refnum 76001238 (Will Marion Cook House) opened at "PAGE Two", losing the first page
  //      of significance: 19,719 characters became 2,759 when the table took priority on the
  //      strength of having matched at all.
  //
  // So each section takes whichever strategy produced more text. Length is a fair test between
  // them because both are bounded by the same section boundaries; what differs is how much of
  // the section each one managed to find.
  const fallbackSections = splitByNarrativeHeadings(normalized);
  const headerCaptured = pick(headerSections);
  const fallbackCaptured = pick(fallbackSections);

  const usedFallback: string[] = [];
  const usedTable: string[] = [];
  const captured = CAPTURED_SECTIONS.map((wanted) => {
    const fromTable = headerCaptured.find((section) => section.section === wanted);
    const fromHeadings = fallbackCaptured.find((section) => section.section === wanted);
    if (fromTable && (!fromHeadings || fromTable.text.length >= fromHeadings.text.length)) {
      usedTable.push(wanted);
      return fromTable;
    }
    if (fromHeadings) usedFallback.push(wanted);
    return fromHeadings;
  }).filter((section): section is NominationSection => section !== undefined);

  // Report what was actually captured, not the whole output of whichever strategy happened to
  // win a section. This used to be `usedTable.length > 0 ? headerSections : fallbackSections`,
  // which is all-or-nothing and so contradicts the per-section choice made just above: a
  // document that took section 7 from the table and section 8 from the headings reported the
  // table's sections and dropped 8 from `sectionsFound` entirely — while `narrative` (built
  // from `captured`) contained it all along. Refnum 100003285 is the measured case: 103,604
  // characters of significance present in the text, absent from the provenance.
  //
  // That mismatch is worse than cosmetic. `sectionsFound` is what a later pass reads to decide
  // whether a record needs re-sweeping, so a row can be re-swept forever to recover a section
  // it already has, or passed over because the field says a section is there when the winning
  // strategy simply happened to list it.
  const sections = captured;
  let segmentation: SectionSegmentation = 'none';
  if (usedTable.length > 0) {
    segmentation = usedFallback.length > 0 ? 'mixed' : 'section-table';
  } else if (usedFallback.length > 0) {
    segmentation = 'narrative-headings';
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
