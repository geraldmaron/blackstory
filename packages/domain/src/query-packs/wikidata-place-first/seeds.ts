/**
 * Curated Wikidata QID seeds for place-first portfolio query packs.
 * Expand per state/campaign; fixture mode only until source-policy approval.
 */
import type { WikidataOccupationSeed, WikidataPlaceSeed } from './types.js';

/** Initial US-state portfolio wave seeds (Deep South civil-rights geography). */
export const US_STATE_PLACE_SEEDS: readonly WikidataPlaceSeed[] = [
  { label: 'Alabama', wikidataId: 'Q173' },
  { label: 'Georgia', wikidataId: 'Q1428' },
  { label: 'Mississippi', wikidataId: 'Q1494' },
] as const;

/** Occupation anchors paired with geographic seeds — not identity-essentializing filters. */
export const CIVIL_RIGHTS_OCCUPATION_SEEDS: readonly WikidataOccupationSeed[] = [
  { label: 'civil rights activist', wikidataId: 'Q82955' },
  { label: 'educator', wikidataId: 'Q37226' },
  { label: 'minister', wikidataId: 'Q42603' },
] as const;

export function assertWikidataIdFormat(wikidataId: string): void {
  if (!/^Q\d+$/u.test(wikidataId.trim())) {
    throw new Error(`Invalid Wikidata id: ${wikidataId}`);
  }
}

export function assertPlaceSeedValid(seed: WikidataPlaceSeed): void {
  if (!seed.label.trim()) {
    throw new Error('Place seed label is required');
  }
  assertWikidataIdFormat(seed.wikidataId);
}

export function assertOccupationSeedValid(seed: WikidataOccupationSeed): void {
  if (!seed.label.trim()) {
    throw new Error('Occupation seed label is required');
  }
  assertWikidataIdFormat(seed.wikidataId);
}
