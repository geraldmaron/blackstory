/**
 * `/about` copy.
 *
 * The page carries two voices on purpose, and the split is the argument.
 *
 * ORIGIN is first person: why one person started this, in plain words, admitting the scale of it.
 * PILLARS and REFUSALS are impersonal, because they are rules the code enforces rather than
 * promises the author makes. A reader should be able to tell, from the writing alone, which
 * sentences are a person talking and which are the archive's behaviour.
 *
 * The destination lists are NOT here. They are generated from `lib/nav/destination-registry.ts`,
 * so a room cannot be described on this page and missing from the footer, or listed here after it
 * stops existing. The previous hardcoded list pointed twice at `/history`, which has been a
 * redirect for months.
 */

/**
 * The product line. `/` first paint uses {@link ABOUT_LINE}; `/about` uses the full lede.
 * Do not retype either on the door.
 */
export const ABOUT_LINE =
  'BlackStory is a place-connected archive of Black history: people, places, and events pinned to where they happened, with the source attached to every claim.';

export const ABOUT_LEDE = `${ABOUT_LINE} I built it with the tools and records available to me, and it is unfinished on purpose.`;

/** Why this exists, in the maker's own voice. Rendered as consecutive paragraphs. */
export const ABOUT_ORIGIN = [
  "I'm not an institution. I'm one person with a laptop, a stack of evenings, and access to more public records than any generation before mine could have searched in a lifetime.",
  "That access started to feel like an obligation. Most of us walk past documented Black history every day without knowing it's there: a school, a street, a building, a court case that decided what the people around us were allowed to do. The records exist. They're just scattered across archives, agency databases, court reporters, and library catalogues that don't talk to each other.",
  'So I started pulling them into one place, pinned to where they happened, with the source attached to every claim. I am learning as I go, and I have gotten things wrong and corrected them where you can see it.',
  'The point was never to be the authority on any of this. It was to build something solid enough that other people could add to it, and trust what they found.',
] as const;

/** What every record stands on. Rules, stated impersonally. */
export const ABOUT_PILLARS = [
  {
    kicker: 'Presence',
    title: 'Pinned to place',
    body: 'People, schools, institutions, and events stay on the ground where they happened. Not a trauma-first feed, and not a remote museum shelf.',
  },
  {
    kicker: 'Evidence',
    title: 'Receipts on every claim',
    body: 'Accepted claims carry citations and a confidence grade you can read. When sources disagree, both stay visible.',
  },
  {
    kicker: 'Dignity',
    title: 'Rules, not tone',
    body: 'Street-level residences stay off the public map. Living people stay protected. Presence is never framed as deficit.',
  },
] as const;

/**
 * What the archive will not do.
 *
 * The registry describes this room as "what this is for, who it is for, and what it refuses to
 * do". The refusals were the third of those and had no section, so the page made a case for
 * itself and never stated its limits.
 */
export const ABOUT_REFUSALS = [
  'Claim to be complete. This archive is missing far more than it holds, and it says so on the pages where that matters.',
  'Draw a point on the map sharper than its source supports. A record known to a county is shown as a county.',
  'Publish a living private person at a street address, or frame anyone as a case study in harm.',
  'Fix a mistake quietly. Corrections are published, with the earlier wording still readable.',
  'Ask you to make an account, or to identify yourself, in order to read anything here.',
] as const;

/** The invitation. Rendered above the take-part cards. */
export const ABOUT_CONTRIBUTE = {
  heading: 'Add to it',
  lede: 'This only stays alive if the people who know something put it in. You do not need an account, an affiliation, or credentials of any kind.',
  terms:
    'Leads are read before anything is published. Nothing you send goes public on arrival, and nothing is published without a source someone else can check. If you tell the archive it is wrong, you get a receipt code and a tracked outcome, not a thank-you note.',
} as const;
