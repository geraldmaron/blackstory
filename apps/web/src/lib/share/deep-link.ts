/**
 * Share deep links for archive records.
 *
 * ADR-017: a shared URL restores *what* the reader was looking at, never *where the camera was*.
 * Live pan/zoom is deliberately absent. The camera is a property of one reader's session, and
 * pinning it would hand the recipient a framing they did not choose and cannot tell from data.
 * `assertNoViewportKeys` enforces that at runtime so the rule survives future edits.
 *
 * Param naming: this module's input fields use the share vocabulary (`record`, `grade`) while the
 * emitted query string uses the params `/explore` already parses (`selected`, `confidence`) — see
 * `../map-experience/url-state.ts`. A share link that `/explore` cannot read is a broken link, so
 * the wire names follow the reader, not this module.
 */

export type ShareDeepLink = {
  readonly record?: string;
  readonly state?: string;
  readonly era?: string;
  readonly grade?: string;
  readonly kind?: string;
};

/** Query keys that would pin a camera. None of these may ever be emitted. */
export const FORBIDDEN_VIEWPORT_KEYS = [
  'lat',
  'lng',
  'lon',
  'longitude',
  'latitude',
  'zoom',
  'bearing',
  'pitch',
  'bbox',
  'center',
] as const;

/** Share field to the query param `/explore` parses. */
const WIRE_KEYS = {
  record: 'selected',
  state: 'state',
  era: 'era',
  grade: 'confidence',
  kind: 'kind',
} as const satisfies Record<keyof ShareDeepLink, string>;

const SHARE_FIELDS = Object.keys(WIRE_KEYS) as ReadonlyArray<keyof ShareDeepLink>;

function assertNoViewportKeys(params: URLSearchParams): void {
  for (const forbidden of FORBIDDEN_VIEWPORT_KEYS) {
    if (params.has(forbidden)) {
      throw new Error(`Share links must not carry viewport state (ADR-017): ${forbidden}`);
    }
  }
}

/** Serializes a share link's query string. Empty when nothing is selected. */
export function buildShareSearchParams(link: ShareDeepLink): string {
  const params = new URLSearchParams();
  for (const field of SHARE_FIELDS) {
    const value = link[field]?.trim();
    if (value) params.set(WIRE_KEYS[field], value);
  }
  assertNoViewportKeys(params);
  return params.toString();
}

export function buildShareHref(link: ShareDeepLink, pathname = '/explore'): string {
  const query = buildShareSearchParams(link);
  return query ? `${pathname}?${query}` : pathname;
}

/** Inverse of `buildShareSearchParams`. Unknown and viewport params are dropped, not thrown on. */
export function parseShareSearchParams(search: string): ShareDeepLink {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const link: {
    -readonly [K in keyof ShareDeepLink]: ShareDeepLink[K];
  } = {};

  for (const field of SHARE_FIELDS) {
    const value = params.get(WIRE_KEYS[field])?.trim();
    if (value) link[field] = value;
  }

  return link;
}
