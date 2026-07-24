/**
 * Mobile About copy — mirrors web `about-copy.ts` mission content for the
 * Ledger storytelling screen (pillars, beats, publish posture, destinations).
 */

export const ABOUT_INTRO = {
  kicker: 'BlackStory',
  title: 'History, pinned to place.',
  lede:
    'A place-connected Black history research platform, so documented history stays findable, especially the history close to you. People. Places. Evidence. Context.',
  supportLine: 'People. Places. Evidence. Context.',
} as const;

export const ABOUT_PILLARS = [
  {
    kicker: 'Presence',
    title: 'Pinned to place',
    body: 'People, schools, institutions, and events stay on the ground, not a trauma-first feed, and not a remote museum shelf.',
    icon: 'place' as const,
  },
  {
    kicker: 'Evidence',
    title: 'Receipts on every claim',
    body: 'Accepted claims carry citations and confidence you can read. When sources disagree, both stay visible.',
    icon: 'methodology' as const,
  },
  {
    kicker: 'Dignity',
    title: 'Rules, not tone',
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
    icon: 'privacy' as const,
  },
] as const;

export const ABOUT_MISSION_BEATS = [
  {
    index: '01',
    title: 'History should not be erased',
    body: 'When sources disagree, both claims stay on the record. When a fact is corrected, the earlier wording remains visible. Withdrawals stay resolvable with a plain-language reason.',
  },
  {
    index: '02',
    title: 'It should not be hard to find',
    body: 'Most people pass documented Black history without knowing it is there. Open the map, start with your state, search by name or place, or follow a decade of movement.',
  },
  {
    index: '03',
    title: 'Accessible because it is about you',
    body: 'Not a remote museum shelf: history pinned to the places people live, teach, report from, and visit, with evidence attached and living people protected.',
  },
] as const;

export const ABOUT_PUBLISH = {
  title: 'Released projections only, with receipts',
  body: 'Public pages show records that passed citation completeness, provenance checks, and living-person protections. Draft work stays off public surfaces. Maps never imply sharper location than the stored precision. Gaps are stated plainly. Completeness is not claimed.',
} as const;

export const ABOUT_DESTINATIONS = [
  {
    href: '/explore',
    label: 'Map',
    detail: 'Documented presence nationwide, then Explore for filters and place-first browsing.',
    icon: 'explore' as const,
  },
  {
    href: '/history',
    label: 'Search',
    detail: 'Find people, places, and events by name or keyword.',
    icon: 'search' as const,
  },
  {
    href: '/history',
    label: 'History',
    detail: 'Follow connections across time and place.',
    icon: 'history' as const,
  },
  {
    href: '/data',
    label: 'Data',
    detail: 'National rollups from cited public statistics: census, ACS, related coverage.',
    icon: 'data' as const,
  },
  {
    href: '/law',
    label: 'Law',
    detail: 'Plain-language entry points to landmark civil-rights statutes and decisions.',
    icon: 'lawRef' as const,
  },
  {
    href: '/submit',
    label: 'Submit',
    detail: 'Offer a lead for research consideration, not an instant public post.',
    icon: 'submit' as const,
  },
] as const;

export const ABOUT_CLOSE = {
  title: 'No account required',
  body: 'Every public page works without authentication. Location sharing on the map is optional and under your control. Reading here does not require creating an identity with us.',
} as const;
