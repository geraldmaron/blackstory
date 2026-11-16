/**
 * Static methodology copy.
 *
 * Speaker: the archive states rules the software enforces. The first-person sentences on the
 * page are the maker's commitments and are marked as such where they are used.
 *
 * Each section opens on its one-sentence answer (`lead`). Enumerations that used to hide inside
 * paragraphs are lists here, so the page can draw them as lists.
 *
 * THE GRADE DEFINITIONS LIVE HERE AND NOWHERE ELSE. Every other page links to
 * `/methodology#evidence-grades` rather than restating them. They describe the one rule in
 * `packages/public-contracts/src/evidence.ts` (`confidenceTierFromEvidenceInputs`); if that rule
 * changes, these sentences change with it.
 */
export const METHODOLOGY_INTRO_LEDE =
  'The receipt for everything else on the site, covering how a record gets in, what its grade means, why a point is never drawn sharper than its source, and what happens when a record touches someone still living.';

export const METHODOLOGY_PAGE_SECTIONS: readonly {
  readonly id: string;
  readonly label: string;
}[] = [
  { id: 'how-a-record-gets-in', label: 'How a record gets in' },
  { id: 'evidence-grades', label: 'Evidence grades' },
  { id: 'editorial-standards', label: 'Editorial standards' },
  { id: 'how-a-point-is-drawn', label: 'How a point is drawn' },
  { id: 'how-it-holds-together', label: 'How it holds together' },
  { id: 'lives-across-decades', label: 'Lives across the decades' },
  { id: 'where-the-evidence-comes-from', label: 'Where the evidence comes from' },
  { id: 'living-person-protection', label: 'Living person protection' },
  { id: 'internet-archive', label: 'Internet Archive' },
] as const;

/* —— How a record gets in ————————————————————————————————————————————————————— */

export const ADMISSION_LEAD =
  'A record publishes only after it is pinned to a real place and its claims are checked against the sources they cite.';

/** The admission pipeline, in the order it runs. */
export const ADMISSION_STEPS = [
  {
    title: 'Found',
    body: 'A research run turns up a candidate and the sources that mention it.',
  },
  {
    title: 'Placed',
    body: 'It is pinned to a state, a city, a campus or a documented site.',
  },
  {
    title: 'Checked',
    body: 'A model from another company tests each proposed claim against its captured source.',
  },
  {
    title: 'Published',
    body: 'A publish gate decides, and a person activates the release.',
  },
] as const;

export const ADMISSION_GREEN_BOOK_NOTE =
  'Negro Motorist Green Book listings skip the model check. A program confirms that the name, address, kind of business and edition year appear exactly in the New York Public Library’s digitized listing data, and each is marked as a registry listing. The address is the one printed in that edition, and the business may be long gone.';

/** The maker's commitment, kept in his voice. */
export const ADMISSION_OWNERSHIP =
  'The model check tests what a source supports, and it can still miss an error in the source. There’s more here than one person can read, so I built these checks and I answer for them. When one gets something wrong, that’s on me, and I fix it where you can see it.';

/** What the publish path holds every record to. */
export const METHODOLOGY_PUBLISH_RULES = [
  {
    title: 'Nothing is asserted without a source',
    body: 'Every public claim carries citations you can open, and the record carries a grade you can read for yourself.',
  },
  {
    title: 'Sources that disagree stay disagreeing',
    body: 'When two sources conflict, the record says so and names both readings. Neither one gets quietly dropped so the page can sound settled.',
  },
  {
    title: 'Corrections append',
    body: 'A fix is added to a record rather than swapped in over it. The earlier reading stays readable, and a withdrawn record still resolves so an old link does not quietly go dead.',
  },
  {
    title: 'Living people are not put on the map at home',
    body: 'Street-level residences stay off public pages, and a point is coarsened before it is drawn.',
  },
] as const;

export const VERIFICATION_STEPS = [
  'Verification starts with the sources closest to the event, or closest to the moment the record itself was made.',
  'Where primary material is thin, the claim is checked against independent secondary scholarship before it counts as corroborated.',
  'Contradictions are written into the notes on the sources instead of being dropped.',
  'Every change is appended to the revision log with an edit summary, so there is no silent edit.',
] as const;

/* —— Evidence grades ————————————————————————————————————————————————————————— */

export const GRADES_LEAD =
  'Every record carries one letter, A, B or C, set by a single rule: its strongest claim, capped by how many independent sources back it.';

/**
 * The record grade, stated once. The letters are the ones the register, the map and every record
 * page print; "Not graded" is an absence of assessment, never a fourth letter.
 */
export const RECORD_GRADE_DEFINITIONS = [
  {
    grade: 'A',
    meaning:
      'The strongest claim is graded high, and two or more independent sources back the record.',
  },
  {
    grade: 'B',
    meaning:
      'A high claim that rests on one independent source, or medium claims backed by two or more.',
  },
  {
    grade: 'C',
    meaning: 'Low claims, or medium claims that rest on one independent source.',
  },
  {
    grade: 'Not graded',
    meaning: 'No claim on the record cites a source yet. That is no assessment, not a poor one.',
  },
] as const;

/** The rule's inputs, in words. */
export const GRADE_RULE_NOTES = [
  'Each claim is stored with a level, high, medium or low, and shows it on the record as its own letter.',
  'Independent means a different publisher. Wikipedia and the record’s own registry listing are cited, but neither counts toward the two.',
  'A grade is printed as a letter, never as a color alone.',
  'A grade measures independence and closeness to the event. Crime statistics and violence-adjacent framing never enter it.',
] as const;

/* —— Editorial standards ———————————————————————————————————————————————————— */

/** Defensibility rails: what a hostile reader can hold any public record to. */
export const EDITORIAL_STANDARDS = [
  {
    title: 'Two independent sources before a high-stakes claim stands alone',
    body: 'Wikipedia and other aggregators may carry a claim into review, but they never corroborate alone. A second source must be able to disagree: a different custody, method, or institution. Superlatives and exclusion designations need an institutional or scholarly source.',
  },
  {
    title: 'Quotes must match the evidence exactly',
    body: 'Every factual enrichment field cites an evidence id and a verbatim quote from the text the drafter was handed. A quote that is not a substring of that evidence is rejected before it can stage.',
  },
  {
    title: 'No evidence means refuse, not pad',
    body: 'When captured sources cannot support a publishable entry, the record is refused or deferred. Thin template prose is not a substitute for a missing history.',
  },
  {
    title: 'Summaries target 400 to 900 characters',
    body: 'The editorial floor is 400 characters, with a hard ceiling at 900. A shorter summary is allowed only when an evidence sweep is exhausted and the draft records an explicit best-effort reason. Silence is not an exception.',
  },
  {
    title: 'Sundown towns and racial violence are documented history, not spectacle',
    body: 'Frame exclusion and violence from dated, sourced records. Prefer agency and significance over trauma as a hook. Do not use lurid detail, and never characterize a town today from a historical designation alone.',
  },
] as const;

/* —— How a point is drawn ————————————————————————————————————————————————————— */

export const PRECISION_LEAD =
  'A record is drawn no sharper than its sources support, and exact residential addresses are not drawn at all.';

export const PRECISION_CONTEXT =
  'Place is how this archive is organized. It is also the field most likely to put a living person on a map at their own front door, so it carries the strictest rules on the site.';

/**
 * The precision steps a public point can take, coarsest first. `precision` is the stored value the
 * figure passes to `recordMarkFor`, so the glyph each row draws is the map's own mark.
 */
export const PRECISION_LEVELS = [
  { level: 'State', precision: 'state', drawn: 'Counted in a statewide tag, no point' },
  { level: 'County', precision: 'county', drawn: 'Counted in a county tag, no point' },
  {
    level: 'City, neighborhood or campus',
    precision: 'campus',
    drawn: 'A hollow ring, never a dot',
  },
  { level: 'Institution or site', precision: 'institution', drawn: 'A solid dot at the site' },
  { level: 'Private residence', precision: null, drawn: 'Never drawn for a living person' },
] as const;

export const DIGNITY_RULES = [
  'Public precision runs from country through campus or institution; never street addresses or exact residence coordinates for living people.',
  'Points render no sharper than stored public precision. A coarsened point is never labeled as an exact address.',
  'No red or alarm hues for violence adjacent records; no crime heat rendering. Color is never the only signal.',
  'Unknown living status is treated as living. Current residential addresses do not appear on public pages or hand offs.',
  'Hard history is documented wherever the sources support it, and the default lens stays presence, meaning people, institutions and places across time.',
] as const;

export const LIMITATION_RULES = [
  'Coverage is uneven across places and eras. Absence on the map is not proof that nothing happened; it may mean sources have not cleared the publish gate yet.',
  'Facts that rest on one source are published with an explicit note on how sure that is, and why.',
  'External statistics (census, ACS, voluntary reporting series) carry their own coverage limits; participation and suppression are part of the reading, not optional footnotes.',
  'Link rot and missing archives happen. Where a web source was captured, the capture travels with the citation; where it was not, the gap is visible.',
] as const;

/* —— How it holds together ———————————————————————————————————————————————————— */

export const STRUCTURE_LEAD =
  'One record is a subject, its claims, the citations under each claim and a grade; the site shows that same catalog three ways.';

export const RECORD_ANATOMY_STEPS = [
  { title: 'Subject', body: 'The person, place, school, business or event.' },
  { title: 'Claims', body: 'One statement each, with its own level.' },
  { title: 'Citations', body: 'The sources under each claim, which you can open.' },
  { title: 'Grade', body: 'One letter from how many independent sources agree.' },
] as const;

export const CATALOG_VIEWS = [
  { title: 'Records', body: 'The whole archive as a list, filtered and sorted.' },
  { title: 'Map', body: 'The same records, drawn at the precision each one carries.' },
  { title: 'Record page', body: 'One record in full: claims, citations, grade and history.' },
] as const;

/* —— Lives across the decades ——————————————————————————————————————————————— */

export const LIVES_METHOD_LEAD =
  'Lives places published federal statistics beside sourced voices, places, laws and records, one life question at a time across the decades.';

/** The rules the Lives lede used to run together in one paragraph. */
export const LIVES_METHOD_POINTS = [
  'The full decade and region tables sit in the evidence appendix.',
  'Every figure names its universe.',
  'Feeling is quoted from a named speaker.',
  'Impact is juxtaposition or a gated claim.',
  'CPI restates published income into comparison-year dollars from 1913 on; it does not invent a historical sticker price for a modern good.',
] as const;

export const LIVES_METHOD_RULES = [
  {
    title: 'Universe before interpretation',
    body: 'Every measure prints the people or households it describes. Tenure and household income remain household measures. Schooling names its age range. The page never says "you would have been."',
  },
  {
    title: 'Published, derived, modeled',
    body: 'Observed cells come from agency tables. Derived income uses chained CPI-U-RS. Modeled affordance compares same-year rent or home value to same-year income and is labeled modeled. Work-based class never enters an affordance model.',
  },
  {
    title: 'Sourced material appears additively',
    body: 'Housing, school, policy, justice, testimony, and war appear only when a sourced beat is ready. Unfinished domain placeholders stay out of the public surface. Authored historical absences name what was searched. Broader series on Data and theme-impact are off-ramps, not Lives region cells. Crime heat is forbidden.',
  },
  {
    title: 'Every group is drawn alike, and every rule is described',
    body: 'Each group’s bar has the same height and weight, so a gap can be read by eye. Every rule that began in a stretch is listed with what it did. What followed a rule is stated on that rule’s own card, from its record and with its source, and never beside the measured gap.',
  },
  {
    title: 'How a voice reached the page',
    body: 'Each account says whether the words are the speaker’s own writing, were told to a writer, were reported by an observer, or come from a recorded interview, and names the writer or interviewer. Recordings play from the archive that holds them and are never copied here. A stretch with no published comparison appears only when there is sourced history to tell, and it says why there is no figure.',
  },
  {
    title: 'Community review: not yet sought',
    body: 'No community reviewer has read the first-person accounts on Lives yet. That review has not been sought as of September 2026. When it is, this entry will name who was asked and what they said.',
  },
] as const;

/* —— Where the evidence comes from ——————————————————————————————————————————— */

/** Canonical public source-library room. Methodology keeps a hash handoff for old links. */
export const METHODOLOGY_SOURCE_LIBRARY_HREF = '/sources';

export const SOURCE_LIBRARY_LEAD =
  'Every public claim traces to a publisher someone can open, and the source library lists every one the archive cites, with how many records cite it.';

/** The evidence chain from discovery to a reader-facing citation. */
export const SOURCE_LINEAGE_STAGES = [
  {
    title: 'Research run',
    body: 'A bounded discovery pass finds a candidate claim and the URL that carried it.',
  },
  {
    title: 'Capture',
    body: 'The cited URL is fetched or anchored in the Wayback Machine so link rot does not erase the reading.',
  },
  {
    title: 'Citation',
    body: 'The claim keeps the publisher, the URL, and the excerpt the drafter was handed.',
  },
  {
    title: 'Record',
    body: 'The citation reaches a public page with a grade and a bibliography you can open.',
  },
] as const;

/**
 * Publisher kinds the source registry recognizes. Examples name real agencies and archives
 * already cited on Data and record pages.
 */
export const SOURCE_PUBLISHER_KINDS = [
  {
    kind: 'Government archive',
    body: 'Federal and state archives, registers, and custody systems that hold primary records.',
    examples: 'National Archives, Library of Congress, NPS National Register of Historic Places',
  },
  {
    kind: 'Government agency',
    body: 'Statistical and regulatory series published by a public agency on its own site.',
    examples:
      'U.S. Census Bureau, Bureau of Justice Statistics, HUD, Federal Reserve Board, United States Sentencing Commission',
  },
  {
    kind: 'Court or legal',
    body: 'Opinions, dockets, and legal repositories where a claim rests on a filed record.',
    examples: 'State supreme courts, federal district archives',
  },
  {
    kind: 'Academic library or archive',
    body: 'University presses, digital libraries, and curated finding aids.',
    examples: 'IPUMS NHGIS, state historical society collections',
  },
  {
    kind: 'Museum and heritage nonprofit',
    body: 'Institutions and nonprofits that steward place-based history with documented custody.',
    examples: 'Smithsonian-affiliated collections, state heritage trusts',
  },
  {
    kind: 'News and reference',
    body: 'Contemporary reporting and reference works that may carry a claim into review but never corroborate alone.',
    examples: 'Regional newspapers, encyclopedias, NPR',
  },
] as const;

/* —— Living person protection ———————————————————————————————————————————————— */

export const METHODOLOGY_DIGNITY_LINE =
  'People are named, and named with the role, place and time the sources give them. Nobody here is background texture for a map.';

export const LIVING_LEAD =
  'When the sources do not say whether someone is living, the archive treats them as living and publishes accordingly.';

/* —— Internet Archive —————————————————————————————————————————————————————— */

export const INTERNET_ARCHIVE_LEAD =
  'BlackStory links out to preserved copies rather than republishing full third-party pages.';
