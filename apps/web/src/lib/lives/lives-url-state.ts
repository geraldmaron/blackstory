/**
 * Shareable URL state for Lives Across the Decades, now a Data section on `/apparatus`.
 * Pure parse/serialize so the server page and the client timeline read and write the same shape,
 * and a copied link reopens the same view.
 *
 * Every group is always on screen; `race` only changes emphasis. Unknown or malformed values fall back
 * to the defaults instead of erroring, so an old or hand-edited link still opens.
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

export const LIVES_TIER_PARAMS = ['all', 'lower', 'middle', 'upper'] as const;

export type LivesTierParam = (typeof LIVES_TIER_PARAMS)[number];

export type LivesViewState = {
  readonly race: LivesLens;
  readonly tier: LivesTierParam;
  readonly decade: LivesDecade;
};

export const DEFAULT_LIVES_VIEW: LivesViewState = {
  race: 'black',
  tier: 'all',
  decade: LIVES_DECADES[0],
};

export const LIVES_CANONICAL_PATH = '/apparatus';

export type RawLivesSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

export function parseLivesSearchParams(raw: RawLivesSearchParams): LivesViewState {
  const race = (firstValue(raw.race) ?? '').trim();
  const tier = (firstValue(raw.tier) ?? '').trim();
  const decadeText = (firstValue(raw.decade) ?? '').trim().replace(/s$/, '');
  const decade = /^\d{4}$/.test(decadeText) ? Number(decadeText) : Number.NaN;
  return {
    race: isLivesLens(race) ? race : DEFAULT_LIVES_VIEW.race,
    tier: (LIVES_TIER_PARAMS as readonly string[]).includes(tier)
      ? (tier as LivesTierParam)
      : DEFAULT_LIVES_VIEW.tier,
    decade: isLivesDecade(decade) ? decade : DEFAULT_LIVES_VIEW.decade,
  };
}

export function parseLivesAreaSlug(raw: RawLivesSearchParams): string {
  const slug = (firstValue(raw.area) ?? '').trim();
  return livesAreaBySlug(slug)?.slug ?? LIVES_NATIONAL.slug;
}

/** View params only: race, tier, decade. Section and area are added by buildLivesHref. */
export function buildLivesSearchParams(state: LivesViewState): string {
  const params = new URLSearchParams();
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', state.tier);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  return params.toString();
}

export function buildLivesHref(areaSlug: string, state: LivesViewState): string {
  const params = new URLSearchParams();
  params.set('s', 'lives');
  if (areaSlug !== LIVES_NATIONAL.slug) params.set('area', areaSlug);
  if (state.race !== DEFAULT_LIVES_VIEW.race) params.set('race', state.race);
  if (state.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', state.tier);
  if (state.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(state.decade));
  return `${LIVES_CANONICAL_PATH}?${params.toString()}`;
}
