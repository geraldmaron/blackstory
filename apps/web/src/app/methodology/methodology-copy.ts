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
  'This page is the receipt for everything else on the site. It covers how a record gets in, what its grade means, why the map never draws a point sharper than its source, and what happens when a record touches someone who’s still living.';

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
  'Before a record publishes, it has to be pinned to a real place, and its claims have to check out against the sources they cite.';

/** The admission pipeline, in the order it runs. */
export const ADMISSION_STEPS = [
  {
    title: 'Found',
    body: 'A research run turns up a candidate and the sources that mention it.',
  },
  {
    title: 'Placed',
    body: 'It’s pinned to a state, a city, a campus or a documented site.',
  },
  {
    title: 'Checked',
    body: 'A model from another company tests each proposed claim against a saved copy of its source.',
  },
  {
    title: 'Published',
    body: 'A last set of automated checks decides, and then a person turns the release on.',
  },
] as const;

export const ADMISSION_GREEN_BOOK_NOTE =
  'Listings from the Negro Motorist Green Book skip the model check. Instead, a program confirms that the name, address, kind of business and edition year appear exactly in the New York Public Library’s digitized listing data, and each one is marked as a registry listing. The address is the one printed in that edition, and the business may be long gone.';

/** The maker's commitment, kept in his voice. */
export const ADMISSION_OWNERSHIP =
  'The model check tests what a source supports, and it can still miss an error in the source. There’s more here than one person can read, so I built these checks and I answer for them. When one gets something wrong, that’s on me, and I fix it where you can see it.';

/** What the publish path holds every record to. */
export const METHODOLOGY_PUBLISH_RULES = [
  {
    title: 'Every claim comes with a source',
    body: 'Every public claim carries citations you can open, and the record carries a grade you can read for yourself.',
  },
  {
    title: 'Sources that disagree stay disagreeing',
    body: 'When two sources conflict, the record says so and names both readings. Neither one gets quietly dropped so the page can sound settled.',
  },
  {
    title: 'A fix never erases what it fixed',
    body: 'A fix gets added to a record, and the earlier wording stays readable. A withdrawn record keeps its address too, so an old link doesn’t quietly go dead.',
  },
  {
    title: 'Living people aren’t put on the map at home',
    body: 'Home addresses stay off public pages, and a point gets widened to a larger area before it’s drawn.',
  },
] as const;

export const VERIFICATION_STEPS = [
  'Checking starts with the sources closest to the event, or closest to the moment the record itself was made.',
  'Where primary material is thin, a claim has to hold up against independent scholarship before it counts as corroborated.',
  'When sources contradict each other, that goes into the notes on those sources. It doesn’t get dropped.',
  'Every change is added to the revision log with a note on what changed, so nothing gets edited silently.',
] as const;

/* —— Evidence grades ————————————————————————————————————————————————————————— */

export const GRADES_LEAD =
  'Every record carries one letter, A, B or C. One rule sets it, and the rule is the record’s strongest claim, capped by how many independent sources back it.';

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
    meaning:
      'No claim on the record cites a source yet. That means it hasn’t been assessed, which isn’t the same as a poor grade.',
  },
] as const;

/** The rule's inputs, in words. */
export const GRADE_RULE_NOTES = [
  'Each claim has its own level (high, medium or low), and the record shows it as that claim’s own letter.',
  'Independent means a different publisher. Wikipedia and the record’s own registry listing get cited, but neither counts toward the two.',
  'A grade is always printed as a letter, so you never have to read it from a color.',
  'A grade measures how independent the sources are and how close they sit to the event. Crime statistics never go into it, and neither does any framing built around violence.',
] as const;

/* —— Editorial standards ———————————————————————————————————————————————————— */

/** Defensibility rails: what a hostile reader can hold any public record to. */
export const EDITORIAL_STANDARDS = [
  {
    title: 'A high-stakes claim needs two independent sources',
    body: 'Wikipedia and other aggregators can bring a claim into review, but they can’t back it up alone. The second source has to be one that could have disagreed, which means different custody, a different method or a different institution. A “first” or an “only,” or a designation that says a place shut people out, needs an institutional or scholarly source.',
  },
  {
    title: 'Quotes have to match the source word for word',
    body: 'Every fact in a record’s write-up points to a specific piece of evidence and quotes it exactly, from the text the drafter was given. If the quote isn’t in that text character for character, the draft is rejected before it goes any further.',
  },
  {
    title: 'When the evidence isn’t there, the record waits',
    body: 'If the saved sources can’t support an entry worth publishing, the record is refused or put off. Filler prose doesn’t stand in for a history nobody has found yet.',
  },
  {
    title: 'Summaries run 400 to 900 characters',
    body: 'The floor is 400 characters and the hard ceiling is 900. A summary can come in shorter only when the search for evidence has run out and the draft says so, with the reason. A blank reason doesn’t count.',
  },
  {
    title: 'Sundown towns and racial violence are documented history, not spectacle',
    body: 'Exclusion and violence are written from dated, sourced records. A record opens on what people did and why the place matters before it gets to the harm. There’s no lurid detail, and a town is never described as it is today on the strength of a historical designation alone.',
  },
] as const;

/* —— How a point is drawn ————————————————————————————————————————————————————— */

export const PRECISION_LEAD =
  'A record is never drawn sharper than its sources support, and exact home addresses aren’t drawn at all.';

export const PRECISION_CONTEXT =
  'Place is how this archive is organized. It’s also the field most likely to put a living person on a map at their own front door, so it gets the strictest rules on the site.';

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
  'Public precision runs from the whole country down to a campus or an institution. It never reaches a street address or exact home coordinates for a living person.',
  'A point is drawn no sharper than the precision stored for the public. A point that’s been widened is never labeled as an exact address.',
  'Records near violence don’t get red or alarm colors, and there’s no crime heat map. Color is never the only signal.',
  'If nobody knows whether a person is living, they’re treated as living. Current home addresses don’t appear on public pages or in links that hand you off to another site.',
  'Hard history is documented wherever the sources support it. The default view is still presence, meaning people, institutions and places across time.',
] as const;

export const LIMITATION_RULES = [
  'Coverage is uneven across places and eras. A blank spot on the map doesn’t prove nothing happened there. It may just mean the sources haven’t cleared the checks yet.',
  'A fact that rests on one source is published with a note saying how sure that is, and why.',
  'Outside statistics (the census, the ACS, series that agencies report voluntarily) come with their own gaps. Who took part and what was suppressed are part of reading the number.',
  'Links rot and archives go missing. Where a web source was saved, the saved copy travels with the citation. Where it wasn’t, you can see the gap.',
] as const;

/* —— How it holds together ———————————————————————————————————————————————————— */

export const STRUCTURE_LEAD =
  'One record is a subject, its claims, the citations under each claim and a grade. The site shows that same catalog three ways.';

export const RECORD_ANATOMY_STEPS = [
  { title: 'Subject', body: 'The person, place, school, business or event.' },
  { title: 'Claims', body: 'One statement each, with its own level.' },
  { title: 'Citations', body: 'The sources under each claim, which you can open.' },
  { title: 'Grade', body: 'One letter, set by how many independent sources agree.' },
] as const;

export const CATALOG_VIEWS = [
  { title: 'Records', body: 'The whole archive as a list, filtered and sorted.' },
  { title: 'Map', body: 'The same records, drawn at the precision each one carries.' },
  { title: 'Record page', body: 'One record in full: claims, citations, grade and history.' },
] as const;

/* —— Lives across the decades ——————————————————————————————————————————————— */

export const LIVES_METHOD_LEAD =
  'Lives puts published federal statistics next to sourced voices, places, laws and records, one question about daily life at a time, decade by decade.';

/** The rules the Lives lede used to run together in one paragraph. */
export const LIVES_METHOD_POINTS = [
  'The full decade and region tables are in the evidence appendix.',
  'Every figure says who it counts.',
  'When the page says how something felt, it’s quoting a named speaker.',
  'What a rule led to is either shown next to the numbers with no causal claim, or stated as a claim that cleared its own source check.',
  'From 1913 on, published incomes are restated in comparison-year dollars using the CPI. That doesn’t invent a historical price tag for a modern product.',
] as const;

export const LIVES_METHOD_RULES = [
  {
    title: 'Who’s counted comes first',
    body: 'Every measure prints the people or households it describes. Tenure and household income stay household measures, and schooling names its age range. The page never says "you would have been."',
  },
  {
    title: 'Published, derived, modeled',
    body: 'Observed figures come from agency tables. Derived income uses the chained CPI-U-RS. Modeled affordability compares rent or home value to income from the same year, and it’s labeled as modeled. Class based on occupation never goes into an affordability model.',
  },
  {
    title: 'A topic shows up when it’s sourced',
    body: 'Housing, school, policy, justice, testimony and war appear only once there’s sourced material ready for them. Unfinished placeholders stay off the public pages. Where a note says the history is missing, it names what was searched. The broader series on Data are somewhere to go next, and they aren’t broken out by Lives region. Crime heat maps are forbidden.',
  },
  {
    title: 'Every group is drawn alike, and every rule is described',
    body: 'Each group’s bar has the same height and weight, so you can read a gap by eye. Every rule that began in a stretch is listed with what it did. What followed a rule is stated on that rule’s own card, from its record and with its source, and never next to the measured gap.',
  },
  {
    title: 'How a voice reached the page',
    body: 'Each account says whether the words are the speaker’s own writing, were told to a writer, were reported by an observer, or come from a recorded interview, and it names the writer or interviewer. Recordings play from the archive that holds them and are never copied here. A stretch with no published comparison appears only when there’s sourced history to tell, and it says why there’s no figure.',
  },
  {
    title: 'No community review yet',
    body: 'No community reviewer has read the first-person accounts on Lives yet, and as of September 2026 that review hasn’t been asked for. When it is, this entry will name who was asked and what they said.',
  },
] as const;

/**
 * The lineage of the Portrait view some Data figures have (docs/ui/DESIGN.md section 9.5). The
 * same credit stands under each Portrait.
 */
export const FIGURE_LINEAGE_CREDIT =
  'A Portrait view on Data follows the forms of the data portraits W.E.B. Du Bois made for the 1900 Paris Exposition, and it’s drawn from the same numbers as the plain chart and the table.';

/* —— Where the evidence comes from ——————————————————————————————————————————— */

/** Canonical public source-library room. Methodology keeps a hash handoff for old links. */
export const METHODOLOGY_SOURCE_LIBRARY_HREF = '/sources';

export const SOURCE_LIBRARY_LEAD =
  'Every public claim traces back to a publisher you can open. The source library lists every one the archive cites, with how many records cite it.';

/** The evidence chain from discovery to a reader-facing citation. */
export const SOURCE_LINEAGE_STAGES = [
  {
    title: 'Research run',
    body: 'A search with a set scope finds a possible claim and the web address it came from.',
  },
  {
    title: 'Capture',
    body: 'The cited page is fetched, or saved in the Wayback Machine, so a dead link doesn’t take the reading with it.',
  },
  {
    title: 'Citation',
    body: 'The claim keeps the publisher, the address and the excerpt the drafter was given.',
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
    body: 'Institutions and nonprofits that look after local history and can show where their material came from.',
    examples: 'Smithsonian-affiliated collections, state heritage trusts',
  },
  {
    kind: 'News and reference',
    body: 'News reporting and reference works. They can bring a claim into review, but they never back one up alone.',
    examples: 'Regional newspapers, encyclopedias, NPR',
  },
] as const;

/* —— Living person protection ———————————————————————————————————————————————— */

export const METHODOLOGY_DIGNITY_LINE =
  'People are named, and named with the role, place and time the sources give them. Nobody here is background texture for a map.';

export const LIVING_LEAD =
  'When the sources don’t say whether someone is living, the archive treats them as living and publishes accordingly.';

/* —— Internet Archive —————————————————————————————————————————————————————— */

export const INTERNET_ARCHIVE_LEAD =
  'BlackStory links out to preserved copies. It doesn’t republish full pages from other sites.';
