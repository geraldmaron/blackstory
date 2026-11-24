/**
 * Mobile About copy — mirrors web `about-copy.ts` mission content for the
 * Ledger storytelling screen (pillars, beats, publish posture, destinations).
 */

export const ABOUT_INTRO = {
  kicker: 'BlackStory',
  title: 'History, pinned to place.',
  lede: 'Black history, pinned to the places it happened, with the source attached to every claim. It’s built so documented history stays easy to find, especially the history close to you.',
  supportLine: 'People. Places. Evidence. Context.',
} as const;

export const ABOUT_PILLARS = [
  {
    kicker: 'Presence',
    title: 'Pinned to place',
    body: 'People, schools, institutions and events stay on the ground where they happened. This isn’t a feed that leads with trauma, and it isn’t a museum shelf you have to travel to.',
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
    title: 'Protections that are enforced',
    body: 'Home addresses stay off the public map, and living people stay protected. Being on the map is never framed as a deficit.',
    icon: 'privacy' as const,
  },
] as const;

export const ABOUT_MISSION_BEATS = [
  {
    index: '01',
    title: 'History shouldn’t be erased',
    body: 'When sources disagree, both claims stay on the record. When a fact is corrected, the earlier wording stays visible. A withdrawn record keeps its address and says why in plain language.',
  },
  {
    index: '02',
    title: 'It shouldn’t be hard to find',
    body: 'Most people pass documented Black history without knowing it’s there. Open the map, start with your state, search by name or place, or follow a decade of movement.',
  },
  {
    index: '03',
    title: 'Accessible because it’s about you',
    body: 'This isn’t a museum shelf somewhere far off. It’s history pinned to the places people live, teach, report from and visit, with the evidence attached and living people protected.',
  },
] as const;

export const ABOUT_PUBLISH = {
  title: 'Only what’s been checked gets published',
  body: 'Public pages show records that passed the citation, provenance and living-person checks. Drafts stay off public pages. The map never implies a sharper location than the stored precision. Gaps are stated plainly, and nothing here claims to be complete.',
} as const;

export const ABOUT_DESTINATIONS = [
  {
    href: '/archive',
    label: 'Map',
    detail: 'Everything published, across the country. Explore adds filters and browsing by place.',
    icon: 'explore' as const,
  },
  {
    href: '/archive?view=list',
    label: 'Records',
    detail: 'The archive as a list. Browse by era, kind and place, or search by name or keyword.',
    icon: 'records' as const,
  },
  {
    href: '/stories',
    label: 'Stories',
    detail: 'Chapters and shorter entries that name the records they stand on.',
    icon: 'stories' as const,
  },
  {
    href: '/data',
    label: 'Data',
    detail: 'National figures from cited public statistics, including the census and the ACS.',
    icon: 'data' as const,
  },
  {
    href: '/law',
    label: 'Law',
    detail: 'Statutes and rulings, in plain language, with the official source on each entry.',
    icon: 'law' as const,
  },
  {
    href: '/submit',
    label: 'Submit',
    detail: 'Send a lead. It gets reviewed before anything is published.',
    icon: 'submit' as const,
  },
] as const;

export const ABOUT_CLOSE = {
  title: 'No account required',
  body: 'Every public page works without signing in. Sharing your location on the map is optional and stays under your control. You never have to say who you are to read here.',
} as const;
