/**
 * Shareable URL state for Lives Across the Decades.
 * Canonical immersive surface is `/lives` (and `/lives?area=`). Data Act II deep-links here.
 * Every group stays on screen; `race` only changes emphasis. `unit` names the subject
 * (household, child, woman). Unknown values fall back to defaults.
 */
import {
  LIVES_DECADES,
  LIVES_NATIONAL,
  LIVES_UNITS,
  isLivesDecade,
  isLivesLens,
  isLivesUnit,
  livesAreaBySlug,
  type LivesDecade,
  type LivesLens,
  type LivesUnit,
} from '@repo/domain/statistics/lives';

export const LIVES_TIER_PARAMS = ['all', 'lower', 'middle', 'upper'] as const;

export type LivesTierParam = (typeof LIVES_TIER_PARAMS)[number];

export type LivesViewState = {
  readonly race: LivesLens;
  readonly tier: LivesTierParam;
  readonly decade: LivesDecade;
  readonly unit: LivesUnit;
};

export const DEFAULT_LIVES_VIEW: LivesViewState = {
  race: 'black',
  tier: 'all',
  decade: LIVES_DECADES[0],
  unit: 'household',
};

/** Immersive Lives room. Data Act II still deep-links with `#lives` into a compact entry. */
export const LIVES_CANONICAL_PATH = '/lives';

export const LIVES_DATA_ENTRY_PATH = '/data';

export type RawLivesSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

export function parseLivesSearchParams(raw: RawLivesSearchParams): LivesViewState {
  const race = (firstValue(raw.race) ?? '').trim();
  const tier = (firstValue(raw.tier) ?? '').trim();
  const unit = (firstValue(raw.unit) ?? '').trim();
  const decadeText = (firstValue(raw.decade) ?? '').trim().replace(/s$/, '');
  const decade = /^\d{4}$/.test(decadeText) ? Number(decadeText) : Number.NaN;
  return {
    race: isLivesLens(race) ? race : DEFAULT_LIVES_VIEW.race,
    tier: (LIVES_TIER_PARAMS as readonly string[]).includes(tier)
      ? (tier as LivesTierParam)
      : DEFAULT_LIVES_VIEW.tier,
    decade: isLivesDecade(decade) ? decade : DEFAULT_LIVES_VIEW.decade,
    unit: isLivesUnit(unit) ? unit : DEFAULT_LIVES_VIEW.unit,
  };
}

export function parseLivesAreaSlug(raw: RawLivesSearchParams): string {
  const slug = (firstValue(raw.area) ?? '').trim();
  return livesAreaBySlug(slug)?.slug ?? LIVES_NATIONAL.slug;
}

export function buildLivesSearchParams(state: LivesViewState): string {
  const params = new URLSearchParams();
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', state.tier);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  if (state.unit !== DEFAULT_LIVES_VIEW.unit) params.set('unit', state.unit);
  return params.toString();
}

/** Immersive Lives href on `/lives`. */
export function buildLivesHref(areaSlug: string, state: LivesViewState): string {
  const params = new URLSearchParams();
  if (areaSlug !== LIVES_NATIONAL.slug) params.set('area', areaSlug);
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', state.tier);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  if (state.unit !== DEFAULT_LIVES_VIEW.unit) params.set('unit', state.unit);
  const query = params.toString();
  return query ? `${LIVES_CANONICAL_PATH}?${query}` : LIVES_CANONICAL_PATH;
}

/** Compact Data Act II entry that still scrolls to `#lives`. */
export function buildLivesDataEntryHref(areaSlug: string, state: LivesViewState): string {
  const params = new URLSearchParams();
  if (areaSlug !== LIVES_NATIONAL.slug) params.set('area', areaSlug);
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', state.tier);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  if (state.unit !== DEFAULT_LIVES_VIEW.unit) params.set('unit', state.unit);
  const query = params.toString();
  const path = query ? `${LIVES_DATA_ENTRY_PATH}?${query}` : LIVES_DATA_ENTRY_PATH;
  return `${path}#lives`;
}

void LIVES_UNITS;
