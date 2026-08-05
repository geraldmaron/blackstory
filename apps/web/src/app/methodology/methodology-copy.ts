/**
 * Static methodology copy: the room kit build. Preserves the accurate trust language from the
 * v6 edition; drops the numbered-beat framing along with the edition chrome it depended on.
 */

export const METHODOLOGY_INTRO_LEDE =
  'History should not be erased. It should not be hard to find. It should be accessible because it is about you. This page is the full receipt: how a record gets in, what its grade means, why a point is never drawn sharper than its source, and how living people are protected.';

export const METHODOLOGY_MISSION_BEATS = [
  {
    kicker: 'Not erased',
    body: 'Corrections append; disagreements stay visible; withdrawn records remain resolvable.',
  },
  {
    kicker: 'Not hidden',
    body: 'Every public claim carries citations and a path back to sources.',
  },
  {
    kicker: 'About you',
    body: 'History pinned to states, cities, campuses, and documented sites near where people live and learn.',
  },
] as const;

/** Aligns with home beat 04 publish rules (`HomeHowThisWorks`). */
export const METHODOLOGY_PUBLISH_RULES = [
  {
    title: 'Every record is documented',
    body: 'People, places, schools, and events carry accepted claims, citations, and confidence you can read yourself.',
  },
  {
    title: 'Contradictions stay visible',
    body: 'When sources disagree, the record says so. Confidence is never a color alone, and disputes stay part of the story.',
  },
  {
    title: 'Dignity is a rule, not a tone',
    body: 'Street level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

export const METHODOLOGY_DIGNITY_LINE =
  'People are named with role and context. No anonymous decoration, no alarm framing, no crime heat rendering on the map.';

export const METHODOLOGY_PAGE_SECTIONS = [
  { id: 'how-a-record-gets-in', label: 'How a record gets in' },
  { id: 'evidence-grades', label: 'Evidence grades' },
  { id: 'precision', label: 'Precision' },
  { id: 'living-person-protection', label: 'Living person protection' },
  { id: 'see-it-applied', label: 'See it applied' },
] as const;

export const VERIFICATION_STEPS = [
  'Identify primary sources closest to the event or record creation.',
  'Cross check against independent secondary scholarship where primaries are sparse.',
  'Document contradictions in confidence notes and counter claims rather than hiding them.',
  'Append every change to the revision log with a mandatory edit summary.',
] as const;

export const DIGNITY_RULES = [
  'Public precision runs from country through campus or institution; never street addresses or exact residence coordinates for living people.',
  'Points render no sharper than stored public precision. A coarsened point is never labeled as an exact address.',
  'No red or alarm hues for violence adjacent records; no crime heat rendering. Color is never the only signal.',
  'Unknown living status is treated as living. Current residential addresses do not appear on public pages or hand offs.',
  'Hard history is documented where the sources support it, but presence (people, institutions, places across time) is the default lens, not a trauma first feed.',
] as const;

export const LIMITATION_RULES = [
  'Coverage is uneven across places and eras. Absence on the map is not proof that nothing happened; it may mean sources have not cleared the publish gate yet.',
  'Single source facts are published only with an explicit confidence note explaining why.',
  'External statistics (census, ACS, voluntary reporting series) carry their own coverage limits; participation and suppression are part of the reading, not optional footnotes.',
  'Link rot and missing archives happen. Where a web source was captured, the capture travels with the citation; where it was not, the gap is visible.',
] as const;
