/**
 * The Atlas instrument is `/explore`, not `/` and not a query on `/`.
 *
 * First paint of `/` is the product: a published place or story. Hiding the 4,101-row
 * catalog behind `?atlas=1` left the old board as the product one param later.
 */
export const ATLAS_INSTRUMENT_HREF = '/explore';
