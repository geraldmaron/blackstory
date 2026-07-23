/**
 * About page copy constants — mission pillars, beats, and destination paths.
 * Preserved from the prior about mast; surfaced in v6 edition Surface panels.
 */

export const ABOUT_PILLARS = [
  {
    kicker: 'Presence',
    title: 'Pinned to place',
    body: 'People, schools, institutions, and events stay on the ground, not a trauma-first feed, and not a remote museum shelf.',
  },
  {
    kicker: 'Evidence',
    title: 'Receipts on every claim',
    body: 'Accepted claims carry citations and confidence you can read. When sources disagree, both stay visible.',
  },
  {
    kicker: 'Dignity',
    title: 'Rules, not tone',
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

export const ABOUT_MISSION_BEATS = [
  {
    index: '01',
    title: 'History should not be erased',
    body: 'When sources disagree, both claims stay on the record. When a fact is corrected, the earlier wording remains visible. Withdrawals stay resolvable with a plain-language reason. Presence and proof travel together: scale on the map, receipts on every record.',
  },
  {
    index: '02',
    title: 'It should not be hard to find',
    body: 'Most people pass documented Black history without knowing it is there. Open the map, start with your state, search by name or place, or follow a decade of movement. Confidence stays readable in words and glyphs, never color alone, with a path to challenge what looks wrong.',
  },
  {
    index: '03',
    title: 'Accessible because it is about you',
    body: 'Not a remote museum shelf: history pinned to the places people live, teach, report from, and visit. Choose a state. Share your location if you want to. Read what happened around you with evidence attached and living people protected.',
  },
] as const;

export const ABOUT_DESTINATIONS = [
  {
    href: '/',
    label: 'Map',
    detail: 'Documented presence nationwide, then Explore for filters and place-first browsing.',
  },
  {
    href: '/history',
    label: 'Search',
    detail: 'Find people, places, and events by name or keyword.',
  },
  {
    href: '/history',
    label: 'History',
    detail: 'Follow connections across time and place.',
  },
  {
    href: '/data',
    label: 'Data',
    detail: 'National rollups from cited public statistics: census, ACS, related coverage.',
  },
  {
    href: '/law',
    label: 'Law',
    detail: 'Plain-language entry points to landmark civil-rights statutes and decisions.',
  },
  {
    href: '/submit',
    label: 'Submit',
    detail: 'Offer a lead for research consideration, not an instant public post.',
  },
] as const;
