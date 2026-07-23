/**
 * Shared edition gutter mosaic density contracts — browse editions get a dense polaroid
 * scatter; detail and utility routes use slightly fewer placements while reusing the
 * same rights-cleared `/brand/collage/tiles/` pool.
 */

/** Primary browse editions (home, about, stories index, law, books, themes, data, …). */
export const EDITION_MOSAIC_COUNT_BROWSE = 56;

/** Record/detail routes and compact utility shells. */
export const EDITION_MOSAIC_COUNT_DETAIL = 40;

/** Default when a route does not override mosaic count. */
export const EDITION_MOSAIC_COUNT_DEFAULT = EDITION_MOSAIC_COUNT_BROWSE;
