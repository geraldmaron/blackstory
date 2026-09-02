/**
 * Static methodology copy: the room kit build. Preserves the accurate trust language from the
 * v6 edition; drops the numbered-beat framing along with the edition chrome it depended on.
 *
 * Speaker: the archive states rules the software enforces. The one first-person sentence on the
 * page lives in `MethodologySections.tsx`, where a person is genuinely making a commitment.
 */

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

export const METHODOLOGY_PAGE_SECTIONS = [
  { id: 'how-a-record-gets-in', label: 'How a record gets in' },
  { id: 'evidence-grades', label: 'Evidence grades' },
  { id: 'how-a-point-is-drawn', label: 'How a point is drawn' },
  { id: 'living-person-protection', label: 'Living person protection' },
  { id: 'see-it-applied', label: 'See it applied' },
] as const;

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
