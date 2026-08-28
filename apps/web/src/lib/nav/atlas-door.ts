/**
 * When `/` is the front door (a place or a story) versus the Atlas instrument.
 *
 * Bare `/` must not boot the 4,101-record catalog. The board stays reachable when the URL
 * asks for it: `?atlas=1`, or any explore filter/selection that would survive
 * `buildExploreSearchParams`. `/explore` and `/map` 308 here.
 */
import {
  buildExploreSearchParams,
  parseExploreSearchParams,
  type RawExploreSearchParams,
} from '../map-experience/url-state';

/** Query flag that opens the Atlas with no other filter. Kept off EXPLORE_URL_PARAM_KEYS so the
 * parse/build drift tests stay a closed set; query-normalization re-attaches it after canonicalize. */
export const ATLAS_DOOR_PARAM = 'atlas';

/** Canonical href for "open the map". Empty explore state used to serialize as `/`, which is now the door. */
export const ATLAS_INSTRUMENT_HREF = '/?atlas=1';

function firstParam(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

function toBag(
  input: string | URLSearchParams | RawExploreSearchParams,
): RawExploreSearchParams {
  if (typeof input === 'string') {
    const qs = input.startsWith('?') ? input.slice(1) : input;
    return Object.fromEntries(new URLSearchParams(qs));
  }
  if (input instanceof URLSearchParams) {
    return Object.fromEntries(input.entries());
  }
  return input;
}

function atlasFlagOn(bag: RawExploreSearchParams): boolean {
  const raw = firstParam(bag[ATLAS_DOOR_PARAM])?.trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

/**
 * True when this request should mount the Atlas (catalog + instruments), not the featured door.
 *
 * A junk-only query is not intent: after allowlist + parse/build it serializes empty, and the
 * door is the honest first paint.
 */
export function wantsAtlasInstrument(
  input: string | URLSearchParams | RawExploreSearchParams,
): boolean {
  const bag = toBag(input);
  if (atlasFlagOn(bag)) return true;
  return buildExploreSearchParams(parseExploreSearchParams(bag)).length > 0;
}
