/**
 * Parses free-text place queries into city + state for locality geocode fallback.
 *
 * Census `onelineaddress` matches street addresses, not bare "City, ST" input. When street
 * geocoding returns empty, callers use this parser (and `./city-centroid.ts`) to resolve a
 * locality centroid the same way ZIP translate-then-discard works.
 */
import { US_STATES } from '../map/us-geography.js';

const STATE_BY_POSTAL = new Map(
  US_STATES.map((state) => [state.postalCode.toUpperCase(), state] as const),
);

const STATE_BY_NAME = new Map(US_STATES.map((state) => [state.name.toLowerCase(), state] as const));

export type ParsedCityState = {
  readonly city: string;
  readonly stateAbbrev: string;
};

/**
 * Extracts a `City, ST` pair from free text. Prefers a trailing city/state after a street
 * segment (`123 Main St, Tulsa, OK`), then a whole-input city/state (`Montgomery, AL`).
 * Returns `undefined` when no in-scope U.S. state token is found.
 */
export function parseCityStateInput(raw: string): ParsedCityState | undefined {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;

  // Street + city + state: "1616 Chappelle St, Tulsa, OK"
  //
  // Split on commas rather than matching `/,\s*([^,]+),\s*([A-Za-z]{2})\s*$/`. Two `\s*` runs
  // around a greedy class let a long run of spaces be divided many ways, which is quadratic
  // (CodeQL js/polynomial-redos). Taking the last two comma-separated parts says the same thing
  // and reads as what it is.
  const commaParts = trimmed.split(',');
  if (commaParts.length >= 3) {
    const tail = commaParts[commaParts.length - 1]!.trim();
    const city = commaParts[commaParts.length - 2]!.trim();
    if (/^[A-Za-z]{2}$/.test(tail)) {
      const stateAbbrev = resolveStateAbbrev(tail);
      if (isPlausibleCityName(city) && stateAbbrev) return { city, stateAbbrev };
    }
  }

  // Whole input: "Montgomery, AL" / "Washington, District of Columbia"
  const commaMatch = /^([^,]+),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z\s]+)$/.exec(trimmed);
  if (commaMatch) {
    const city = commaMatch[1]!.trim();
    const stateAbbrev = resolveStateAbbrev(commaMatch[2]!.trim());
    if (isPlausibleCityName(city) && stateAbbrev) return { city, stateAbbrev };
  }

  // Whole input without comma: "Tulsa OK"
  //
  // Found by the last whitespace run rather than `/^(.+?)\s+([A-Za-z]{2})$/`, whose lazy head
  // beside a greedy whitespace run is the quadratic shape.
  const lastSpace = trimmed.search(/\s\S*$/);
  if (lastSpace > 0) {
    const tail = trimmed.slice(lastSpace).trim();
    const city = trimmed.slice(0, lastSpace).trim();
    if (/^[A-Za-z]{2}$/.test(tail)) {
      const stateAbbrev = resolveStateAbbrev(tail);
      if (isPlausibleCityName(city) && stateAbbrev) return { city, stateAbbrev };
    }
  }

  return undefined;
}

function isPlausibleCityName(city: string): boolean {
  if (!city || /^\d/.test(city)) return false;
  // Reject leftover street-looking fragments that still carry a house number mid-string.
  if (/\b\d{1,5}\s+[A-Za-z]/.test(city)) return false;
  return true;
}

function resolveStateAbbrev(token: string): string | undefined {
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  if (trimmed.length === 2) {
    const postal = trimmed.toUpperCase();
    return STATE_BY_POSTAL.has(postal) ? postal : undefined;
  }
  return STATE_BY_NAME.get(trimmed.toLowerCase())?.postalCode;
}
