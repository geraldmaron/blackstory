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
