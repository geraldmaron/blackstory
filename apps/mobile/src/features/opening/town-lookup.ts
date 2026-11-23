/**
 * "Your story": a typed town, answered by the search the app already has.
 *
 * Privacy (docs/ui/DESIGN.md section 9.7 (d)): the field takes typed text only. The text goes
 * out once, as the `q` of one `/v1/search` request, and is held nowhere else: it is not written
 * to recent searches, the cache, storage, the address, analytics or a log line. Nothing here
 * reads the device's position.
 *
 * What it cannot do without new API surface: say which records are NEAREST and how far. The app
 * has no place lookup that turns a town into a point (the web's is `/locate/api`, on the web
 * app), and a map feature carries a state but no town. So this answers with records whose own
 * text names the town, and says plainly when none does.
 */
import type { SearchResponseV1 } from '@repo/public-contracts/v1/search';

import type { EntityDataDeps } from '@/features/entity/dataClient';
import { buildSearchRequestPath } from '@/features/search/search-contracts';

export const TOWN_MIN_LENGTH = 2;
export const TOWN_MAX_LENGTH = 80;
export const TOWN_RESULT_LIMIT = 3;

export type TownAnswer =
  | { readonly kind: 'found'; readonly records: readonly { id: string; name: string }[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'failed' };

/** Trims and bounds what was typed; null when there is nothing to look up. */
export function normalizeTown(raw: string): string | null {
  const town = raw.replace(/\s+/g, ' ').trim().slice(0, TOWN_MAX_LENGTH);
  return town.length >= TOWN_MIN_LENGTH ? town : null;
}

/** The read half of the app's transport, as the record screens already receive it. */
export type TownTransport = EntityDataDeps['transport'];

export async function lookUpTown(transport: TownTransport, town: string): Promise<TownAnswer> {
  try {
    const result = await transport.readJson<SearchResponseV1>(
      buildSearchRequestPath({ query: town, pageSize: TOWN_RESULT_LIMIT }),
    );
    if (result.kind !== 'ok' || !Array.isArray(result.data?.results)) return { kind: 'failed' };
    const records = result.data.results
      .slice(0, TOWN_RESULT_LIMIT)
      .map((record) => ({ id: record.id, name: record.displayName }));
    return records.length > 0 ? { kind: 'found', records } : { kind: 'none' };
  } catch {
    return { kind: 'failed' };
  }
}
