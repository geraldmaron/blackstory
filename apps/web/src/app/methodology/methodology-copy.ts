/**
 * Static methodology copy constants for v6 edition beats. Preserves accurate
 * trust language; shared publish rules align with home beat 04 evidence band.
 */

export const METHODOLOGY_INTRO_LEDE =
  'History should not be erased. It should not be hard to find. It should be accessible because it is about you. This page is the full receipt: definitions, source rules, confidence grades, map dignity limits, and correction policy so you can verify a record yourself.';

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
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

export const METHODOLOGY_DIGNITY_LINE =
  'People are named with role and context. No anonymous decoration, no alarm framing, no crime-heat rendering on the map.';

export const METHODOLOGY_PAGE_SECTIONS = [
  { id: 'mission', label: 'Mission' },
  { id: 'evidence-pipeline', label: 'Evidence' },
  { id: 'research-pipeline', label: 'Research flow' },
  { id: 'how-to-read', label: 'How to read' },
  { id: 'definitions', label: 'Definitions' },
  { id: 'sources', label: 'Sources' },
  { id: 'standards', label: 'Standards' },
  { id: 'operations', label: 'Operations' },
] as const;
