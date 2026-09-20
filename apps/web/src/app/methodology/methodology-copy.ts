/**
 * Static methodology copy: the room kit build. Preserves the accurate trust language from the
 * v6 edition; drops the numbered-beat framing along with the edition chrome it depended on.
 *
 * Speaker: the archive states rules the software enforces. The one first-person sentence on the
 * page lives in `MethodologySections.tsx`, where a person is genuinely making a commitment.
 */
import type { DestinationIconId } from '@repo/public-contracts/destinations';

export const METHODOLOGY_INTRO_LEDE =
  'This page is the receipt for everything else on the site: how a record gets in, what an evidence grade means, why a map point is never drawn sharper than the source behind it, and what happens when a record touches someone still living. It is written out in full so a reader can hold any page here to it.';

export const METHODOLOGY_MISSION_BEATS = [
  {
    kicker: 'Corrections append',
    body: 'A fix is added to a record rather than swapped in over it. The earlier reading stays readable, a disagreement stays on the page, and a withdrawn record still resolves so an old link does not quietly go dead.',
  },
  {
    kicker: 'Nothing is asserted without a source',
    body: 'Every public claim carries citations you can open.',
  },
] as const;

/** The three rules the publish path applies before anything reaches a public page. */
export const METHODOLOGY_PUBLISH_RULES = [
  {
    title: 'Every record is documented',
    body: 'People, places, schools and events carry accepted claims, the citations behind them, and an evidence grade you can read for yourself.',
  },
  {
    title: 'Sources that disagree stay disagreeing',
    body: 'When two sources conflict, the record says so and names both readings. Neither one gets quietly dropped so the page can sound settled.',
  },
  {
    title: 'Living people are not put on the map at home',
    body: 'Street level residences stay off public pages, and a point is coarsened before it is drawn.',
  },
] as const;

export const METHODOLOGY_DIGNITY_LINE =
  'People are named, and named with the role, place and time the sources give them. Nobody here is background texture for a map.';

export const METHODOLOGY_PAGE_SECTIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly icon: DestinationIconId;
}[] = [
  { id: 'how-a-record-gets-in', label: 'How a record gets in', icon: 'records' },
  { id: 'evidence-grades', label: 'Evidence grades', icon: 'evidence' },
  { id: 'editorial-standards', label: 'Editorial standards', icon: 'publication' },
  { id: 'how-a-point-is-drawn', label: 'How a point is drawn', icon: 'precision' },
  { id: 'how-it-holds-together', label: 'How it holds together', icon: 'collection' },
  { id: 'lives-across-decades', label: 'Lives across the decades', icon: 'person' },
  { id: 'where-the-evidence-comes-from', label: 'Where the evidence comes from', icon: 'source' },
  { id: 'living-person-protection', label: 'Living person protection', icon: 'privacy' },
  { id: 'internet-archive', label: 'Internet Archive', icon: 'collection' },
  { id: 'see-it-applied', label: 'See it applied', icon: 'explore' },
] as const;

/** Canonical public source-library room. Methodology keeps a hash handoff for old links. */
export const METHODOLOGY_SOURCE_LIBRARY_HREF = '/sources';

export const LIVES_METHOD_LEDE =
  'Lives Across the Decades places published federal statistics beside sourced voices, places, laws, and records. A reader chooses one life question and follows it across the decades; the full decade and region tables sit in the evidence appendix. Every figure names its universe. Feeling is quoted from a named speaker. Impact is juxtaposition or a gated claim. CPI restates published income into comparison-year dollars from 1913 on; it does not invent a historical sticker price for a modern good.';

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

export const SOURCE_LIBRARY_LEDE =
  'Every public claim on BlackStory traces to a publisher someone can open. This section names the kinds of publishers the archive cites, shows how a URL becomes a citation on a record, and points to where each surface lists its sources. Counts and publisher profiles stay tied to the active release; nothing here is invented.';

/** The evidence chain from discovery to a reader-facing citation. */
export const SOURCE_LINEAGE_STAGES = [
  {
    step: '01',
    title: 'Research run',
    body: 'A bounded discovery pass finds a candidate claim and the URL that carried it.',
    icon: 'records' as const,
  },
  {
    step: '02',
    title: 'Capture',
    body: 'The cited URL is fetched or anchored in the Wayback Machine so link rot does not erase the reading.',
    icon: 'source' as const,
  },
  {
    step: '03',
    title: 'Citation',
    body: 'The claim keeps the publisher, the URL, and the excerpt the drafter was handed.',
    icon: 'evidence' as const,
  },
  {
    step: '04',
    title: 'Record',
    body: 'The citation reaches a public page with an evidence grade and a bibliography you can open.',
    icon: 'publication' as const,
  },
] as const;

/**
 * Publisher kinds the source registry recognizes. Examples name real agencies and archives
 * already cited on Data and record pages; no usage counts are shown on this public surface.
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
    kind: 'Court / legal',
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

/** Where a reader already sees sources on the public site. */
export const SOURCE_LIBRARY_SURFACES = [
  {
    title: 'Data figures',
    body: 'Every chart on Data names the agency series beneath it. Those are published statistics, not claims drawn from the record catalog.',
    href: '/data#reading',
    icon: 'data' as const,
  },
  {
    title: 'Record pages',
    body: 'Each place, person, and event page lists the citations behind its claims, with archived copies when the Internet Archive holds them.',
    href: '/records',
    icon: 'records' as const,
  },
  {
    title: 'Internet Archive handoff',
    body: 'When a citation points to archive.org or the Wayback Machine, the record page lists those preserved copies beside the bibliography.',
    href: '/methodology#internet-archive',
    icon: 'collection' as const,
  },
] as const;

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

export const METHODOLOGY_STRUCTURE_LEDE =
  'Two structures underneath everything above: how one record is put together, and how the site lets you reach it.';

/** The grades in plain English. Shop field names stay off this page. */
export const EVIDENCE_GRADE_DEFINITIONS = {
  established:
    'Several independent, high-authority sources agree, and there is no serious dispute.',
  corroborated:
    'Two or more independent sources support the statement. Small gaps may remain, but they do not undo the core claim.',
  'single-source':
    'One source that meets the citation bar. Not necessarily wrong, and not yet checked against another.',
  contested:
    'Credible sources disagree, or the statement rests on a source with a known reliability problem. The record names the disagreement in plain language.',
} as const;

export const VERIFICATION_STEPS = [
  'Verification starts with the sources closest to the event, or closest to the moment the record itself was made.',
  'Where primary material is thin, the claim is checked against independent secondary scholarship before it counts as corroborated.',
  'Contradictions are written into the notes on the sources instead of being dropped.',
  'Every change is appended to the revision log with an edit summary, so there is no silent edit.',
] as const;

export const DIGNITY_RULES = [
  'Public precision runs from country through campus or institution; never street addresses or exact residence coordinates for living people.',
  'Points render no sharper than stored public precision. A coarsened point is never labeled as an exact address.',
  'No red or alarm hues for violence adjacent records; no crime heat rendering. Color is never the only signal.',
  'Unknown living status is treated as living. Current residential addresses do not appear on public pages or hand offs.',
  'Hard history is documented wherever the sources support it, and the default lens stays presence: people, institutions and places across time.',
] as const;

export const LIMITATION_RULES = [
  'Coverage is uneven across places and eras. Absence on the map is not proof that nothing happened; it may mean sources have not cleared the publish gate yet.',
  'Facts that rest on one source are published with an explicit note on how sure that is, and why.',
  'External statistics (census, ACS, voluntary reporting series) carry their own coverage limits; participation and suppression are part of the reading, not optional footnotes.',
  'Link rot and missing archives happen. Where a web source was captured, the capture travels with the citation; where it was not, the gap is visible.',
] as const;
