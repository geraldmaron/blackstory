/**
 * Place arrival query helpers (v10 DiscoveryState handoff).
 *
 * Leaf module on purpose: Explore (`'use client'`) appends these params when walking into a
 * Place. It must not import `discovery-state.ts`, which pulls Records href builders and
 * server-only domain packages into the client bundle.
 */

export function withQuery(href: string, query: string): string {
  if (query.length === 0) return href;
  return href.includes('?') ? `${href}&${query}` : `${href}?${query}`;
}

export type PlaceArrivalFields = {
  readonly query?: string;
  readonly kind?: string;
  readonly era?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly evidence?: string;
  readonly status?: string;
  readonly selected?: string;
};

/**
 * Serializes Place arrival URLs (`from=map|list` + shared filters).
 * Must stay aligned with `PLACE_PAGE_PARAM_ALLOWLIST` and `discoveryFromSearchParams`.
 */
export function placeArrivalQuery(fields: PlaceArrivalFields, from: 'map' | 'list'): string {
  const params = new URLSearchParams();
  params.set('from', from);
  if (fields.query) params.set('q', fields.query);
  if (fields.kind) params.set('kind', fields.kind);
  if (fields.era) params.set('era', fields.era);
  if (fields.state) params.set('state', fields.state);
  if (fields.topic) params.set('topic', fields.topic);
  if (fields.evidence) params.set('evidence', fields.evidence);
  if (fields.status) params.set('status', fields.status);
  if (fields.selected) params.set('selected', fields.selected);
  return params.toString();
}
