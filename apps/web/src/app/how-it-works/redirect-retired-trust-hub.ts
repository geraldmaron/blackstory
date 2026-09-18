/**
 * Query-aware redirects from the retired merged trust hub (`/how-it-works`, `/apparatus`).
 *
 * Bare arrivals land on About. `?s=` maps to the individual room that owns that chapter.
 * Lives view params (area, race, tier, decade) survive onto `/data`.
 */
import { permanentRedirect } from 'next/navigation';
import {
  buildLivesHref,
  parseLivesAreaSlug,
  parseLivesSearchParams,
} from '../../lib/lives/lives-url-state';

export type RawTrustHubSearchParams = Readonly<Record<string, string | string[] | undefined>>;

function firstValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

const SECTION_PATH: Readonly<Record<string, string>> = Object.freeze({
  about: '/about',
  methodology: '/methodology',
  data: '/data',
  law: '/law',
  books: '/books',
});

/** Permanent-redirect into the room that replaced the merged hub chapter. */
export function redirectRetiredTrustHub(raw: RawTrustHubSearchParams): never {
  const section = (firstValue(raw.s) ?? '').trim().toLowerCase();

  if (section === 'lives') {
    permanentRedirect(buildLivesHref(parseLivesAreaSlug(raw), parseLivesSearchParams(raw)));
  }

  const path = SECTION_PATH[section];
  if (path) permanentRedirect(path);

  permanentRedirect('/about');
}
