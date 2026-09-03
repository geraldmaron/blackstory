/**
 * `/about` copy.
 *
 * The page carries two voices on purpose, and the split is the argument.
 *
 * ORIGIN, the human half of the Neo section, and the contribute invitation are first person:
 * one person started this, one person runs it, and the limits on that are his to state.
 * PILLARS, REFUSALS and the rules half of the Neo section are impersonal, because they are
 * behavior the code enforces rather than promises the author makes. A reader should be able to
 * tell, from the writing alone, which sentences are a person talking and which are the archive's
 * behavior. Nothing on this page says "we": there is no we.
 *
 * SHARED STRINGS. `ABOUT_WALK_PAST` and `ABOUT_ON_THE_GROUND` are declared as their own constants
 * and then placed into the lists below, rather than read back out by index. The index form broke
 * silently the moment a paragraph was inserted above them, and inserting paragraphs is what a
 * rewrite of this page does.
 *
 * The destination lists are NOT here. They are generated from `lib/nav/destination-registry.ts`,
 * so a room cannot be described on this page and missing from the footer, or listed here after it
 * stops existing. The previous hardcoded list pointed twice at `/history`, which has been a
 * redirect for months.
 */

/**
 * The product line. The door mast is this string. `/about` uses the full lede.
 * Do not retype either. Scribe locked the mast; paint imports it.
 */
export const ABOUT_LINE =
  'BlackStory is a place-connected archive of Black history: people, places, and events pinned to where they happened, with the source attached to every claim.';

/** Brand support line. Keep on the door under the product name. */
export const ABOUT_SUPPORT_LINE = 'People. Places. Evidence. Context.';

export const ABOUT_LEDE = `${ABOUT_LINE} I built it with the tools and records available to me, and it is unfinished on purpose.`;

/** Origin paragraph the door steals. You walk past the place. Do not retype. */
export const ABOUT_WALK_PAST =
  "That access started to feel like an obligation. Most of us walk past documented Black history every day without knowing it's there: a school, a street, a building, a court case that decided what the people around us were allowed to do. The records exist. They're just scattered across archives, agency databases, court reporters, and library catalogs that don't talk to each other.";

/** Why this exists, in the maker's own voice. Rendered as consecutive paragraphs. */
export const ABOUT_ORIGIN = [
  "I'm not an institution. I'm one person with a laptop, a stack of evenings, and access to more public records than any generation before mine could have searched in a lifetime.",
  ABOUT_WALK_PAST,
  "I'm not a historian, and I'm not an expert in the software I use to do this. What I have is the means, and enough command of the tools to put history that other people are working to hide in front of more of the people it belongs to. That is the size of the claim, and I would rather state it that small than dress it up.",
  'So I started pulling the records into one place, pinned to where they happened, with the source attached to every claim. I have gotten things wrong. Those are in the errata with the earlier wording still readable, because a correction you cannot check is just a second assertion.',
  "This was never going to be finished by one person, and I was never going to be the authority on any of it. I'll do my part for as long as I can. The rest of the work is making this solid enough that somebody else can add to it and trust what they find.",
] as const;

/** Place pillar body. The ground the record sits on. Do not retype. */
export const ABOUT_ON_THE_GROUND =
  'People, schools, congregations, businesses and events are pinned to the ground they happened on, at the precision their sources support, so a record is something you can go and stand in front of.';

/** What every record stands on. Rules, stated impersonally. */
export const ABOUT_PILLARS = [
  {
    kicker: 'Place',
    title: 'Every record sits somewhere you can stand',
    body: ABOUT_ON_THE_GROUND,
  },
  {
    kicker: 'Evidence',
    title: 'Citations, and a grade for how sure the archive is',
    body: 'An accepted claim carries its citations and one of four grades: established, corroborated, single source, contested. The grade is spelled out in words beside its mark, so reading it never depends on telling two colors apart. Where the sources disagree, the record says so and keeps both of them.',
  },
  {
    kicker: 'Precision',
    title: 'A point is drawn no sharper than its source',
    body: 'A record known to a county is drawn as a county, and a coarsened point is never labeled as an address.',
  },
  {
    kicker: 'Living people',
    title: 'The protections are in the code, not in the tone',
    body: 'Public precision stops at a city, a campus or an institution. Current residential addresses for living private people do not appear on public pages, and a record whose living status is unknown is treated as living.',
  },
] as const;

/**
 * How the long-form writing gets made, including the part most sites leave out.
 *
 * `rules` is the archive stating its own procedure; `human` is the maker stating what he does not
 * hand off; `hand` is the one thing here that is made with a pen. Every claim in this block is
 * checkable in the repository: `docs/content/neo-voice.md` (the voice document and the
 * evidence-gate rule), `docs/methodology/chapter-fact-validation.md` (facts from fetched sources,
 * never from a model's memory), the two review skills under `.claude/skills/blackstory/`, the
 * gates in `packages/ops-data/scripts/articles.ts`, and `brand/cover-lock/v1/README.md` with
 * `packages/domain/src/publication/cover-package.ts` for the cover plates. No step is described
 * here that those files do not describe.
 */
export const ABOUT_NEO = {
  heading: 'How the writing is made',
  rules: [
    'The long-form writing here, the chapters and the articles, is narrated in a single voice. The voice is called Neo. Neo is not a person, not a byline, and signs nothing. It is a written standard kept in the project as docs/content/neo-voice.md, and whoever, or whatever, is doing the writing has to work under it: how a document gets quoted, which sentences have to carry a citation, and which endings are off limits.',
    'AI drafts that prose. Saying so here is cheaper than letting you find it out. A piece is drafted under the voice document, then read line by line against it for voice and for the dignity of the people in the file, then handed to a second review whose only job is to attack it: the sentence a specialist would write a letter about, the twelve seconds that travel badly with the paragraph stripped off. A finding from that review is a blocker the writer cannot overrule. After it, the piece still has to clear the code gates on source tiers, citations and length before anything publishes.',
    "None of that can move the evidence bar. Voice never relaxes an evidence gate. Facts are gathered from fetched sources and checked before any prose is written, never from a model's memory, and load-bearing figures need two independent sources. When a detail cannot be sourced, the scene is written without it.",
  ],
  human: [
    'What does not get handed to a machine: I decide what gets researched, I read what comes in, and a release reaches the public site because a person activated it. When the archive is wrong, it is wrong in my name and I fix it where you can see it.',
  ],
  hand: 'One part of this is made with a pen and stays that way. The cover plate on an article is a scan of a real drawing: dry felt-tip on cream paper, one weight of line, hatch fills, a sliver of burnt ochre. It is not a generated image and not a stock photo, and that is enforced rather than promised. A plate whose file, link or caption points at a stock library or an image generator cannot publish.',
} as const;

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
  'Publish a fact because a model produced it. Facts come from fetched sources and are checked before any of the writing starts.',
  'Publish a living private person at a street address, or frame anyone as a case study in harm.',
  'Fix a mistake quietly. Corrections are published, with the earlier wording still readable.',
  'Ask you to make an account, or to identify yourself, in order to read anything here.',
] as const;

/** The invitation. Rendered above the take-part cards. */
export const ABOUT_CONTRIBUTE = {
  heading: 'Add to it',
  lede: 'Most of what is missing here is already known by somebody, and often that somebody is not in an archive at all. You do not need an account or a credential to hand it over.',
  terms:
    'I read every lead before anything is published. Nothing you send goes public on arrival, and nothing is published without a source someone else can check. If you tell the archive it is wrong, you get a receipt code and a tracked outcome, not a thank-you note.',
  direct: 'If a form is the wrong shape for what you have, write to me:',
} as const;
