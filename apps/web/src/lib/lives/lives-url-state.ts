/**
 * Shareable URL state for Lives Across the Decades.
 * The guided reader is `/lives`; this state belongs to the decade × area evidence appendix.
 * Every group stays on screen; `race` only changes emphasis. Unknown values fall back to defaults.
 */
import {
  LIVES_DECADES,
  LIVES_NATIONAL,
  isLivesDecade,
  isLivesLens,
  livesAreaBySlug,
  type LivesDecade,
  type LivesLens,
} from '@repo/domain/statistics/lives';

export type LivesViewState = {
  readonly race: LivesLens;
  readonly decade: LivesDecade;
};

export const DEFAULT_LIVES_VIEW: LivesViewState = {
  race: 'black',
  decade: LIVES_DECADES[0],
};

/** Immersive Lives room. Data Act II still deep-links with `#lives` into a compact entry. */
export const LIVES_CANONICAL_PATH = '/lives';

export const LIVES_EXPLORER_PATH = '/lives/explorer';

export const LIVES_DATA_ENTRY_PATH = '/data';

export type RawLivesSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

export function parseLivesSearchParams(raw: RawLivesSearchParams): LivesViewState {
  const race = (firstValue(raw.race) ?? '').trim();
  const decadeText = (firstValue(raw.decade) ?? '').trim().replace(/s$/, '');
  const decade = /^\d{4}$/.test(decadeText) ? Number(decadeText) : Number.NaN;
  return {
    race: isLivesLens(race) ? race : DEFAULT_LIVES_VIEW.race,
    decade: isLivesDecade(decade) ? decade : DEFAULT_LIVES_VIEW.decade,
  };
}

export function parseLivesAreaSlug(raw: RawLivesSearchParams): string {
  const slug = (firstValue(raw.area) ?? '').trim();
  return livesAreaBySlug(slug)?.slug ?? LIVES_NATIONAL.slug;
}

export function buildLivesSearchParams(state: LivesViewState): string {
  const params = new URLSearchParams();
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  return params.toString();
}

/** Decade × area evidence href. */
export function buildLivesHref(areaSlug: string, state: LivesViewState): string {
  const params = new URLSearchParams();
  if (areaSlug !== LIVES_NATIONAL.slug) params.set('area', areaSlug);
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  const query = params.toString();
  return query ? `${LIVES_EXPLORER_PATH}?${query}` : LIVES_EXPLORER_PATH;
}

/** Compact Data Act II entry that still scrolls to `#lives`. */
export function buildLivesDataEntryHref(areaSlug: string, state: LivesViewState): string {
  const params = new URLSearchParams();
  if (areaSlug !== LIVES_NATIONAL.slug) params.set('area', areaSlug);
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  const query = params.toString();
  const path = query ? `${LIVES_DATA_ENTRY_PATH}?${query}` : LIVES_DATA_ENTRY_PATH;
  return `${path}#lives`;
}
