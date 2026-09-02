/**
 * Pure classification + parsing for `backfill-nrhp-addresses.ts` (repo-2qbj WS2). Split into a
 * `lib/` module with no `main()` entrypoint so it can be imported by its test file without
 * triggering the orchestrating script's network/DB `main()` — matching this package's convention
 * (see `lib/nrhp-area-labels.ts`, `lib/corroborate-source.ts`) of keeping side-effect-free logic
 * out of the top-level scripts that run it against Postgres and the network.
 *
 * See `backfill-nrhp-addresses.ts`'s module doc for the outcome/tier-table reasoning; this file
 * is only the mechanics.
 */

export type NrhpArcgisAttributes = {
  readonly refnum: string;
  readonly resname: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly county: string | null;
  readonly state: string | null;
  readonly vicinity: string | null;
  readonly isExtant: string | null;
  readonly extantOther: string | null;
  readonly constraint: string | null;
  readonly srcAccu: string | null;
  readonly mapMethod: string | null;
  readonly boundaryType: string | null;
  readonly resType: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
};

export type NrhpAddressOutcome =
  'restricted' | 'address_found' | 'vicinity' | 'coordinates_only' | 'no_match';

export type NrhpVisitability = 'extant' | 'not_extant' | 'unknown';

const FEET_TO_METERS = 0.3048;

/** NPS spells this "+/- 12 meters" / "5m" / "0.5-foot RMSE" / "Unknown" (verified across the full
 *  lane: 1,425 "+/- 12 meters", 304 "Unknown", a handful of "Nm"/"+/- N meters", one "N-foot
 *  RMSE"). Pulls the first integer-or-decimal run and converts to meters when the unit is feet;
 *  returns null when there is no number (covers "Unknown" and any future unrecognized string). */
export function parseSrcAccuMeters(srcAccu: string | null | undefined): number | null {
  if (!srcAccu) return null;
  const match = /(\d+(?:\.\d+)?)/u.exec(srcAccu);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const isFeet = /foot|feet|\bft\b/iu.test(srcAccu);
  return isFeet ? value * FEET_TO_METERS : value;
}

/** IS_EXTANT is "Yes"/"No"/"Unknown" (case varies); EXTANT_OTH is free-text prose the caller
 *  displays as-is and this function never parses. */
export function classifyVisitability(isExtant: string | null | undefined): NrhpVisitability {
  const normalized = (isExtant ?? '').trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'true' || normalized === 'extant') return 'extant';
  if (normalized === 'no' || normalized === 'false' || normalized === 'not extant')
    return 'not_extant';
  return 'unknown';
}

/**
 * The whole outcome decision in one place so the DB/network shell can stay thin.
 * Order matters: restricted always wins (never emit an address for a roster-flagged row,
 * regardless of what the layer itself says); then no_match (nothing to classify); then
 * vicinity (Address is present but describes an area, not the parcel); then address_found;
 * then coordinates_only (geometry with no usable text); everything else is no_match.
 */
export function classifyNrhpAddressOutcome(input: {
  readonly restrictedAddress: boolean;
  readonly feature: NrhpArcgisAttributes | null;
}): NrhpAddressOutcome {
  if (input.restrictedAddress) return 'restricted';
  const feature = input.feature;
  if (!feature) return 'no_match';
  const vicinityTrue = (feature.vicinity ?? '').trim().toLowerCase() === 'true';
  if (vicinityTrue) return 'vicinity';
  const address = (feature.address ?? '').trim();
  if (address.length > 0) return 'address_found';
  if (feature.lat !== null && feature.lng !== null) return 'coordinates_only';
  return 'no_match';
}

/**
 * THE tier table. One exported constant so a future standards-research pass can change the
 * proposal without touching classification or the DB/network logic in the orchestrating script.
 * Reuses this lane's own already-published precision vocabulary (see the orchestrating script's
 * module doc) — 'site' for a parcel-level address, a high-confidence coordinates_only hit, or an
 * entity_locations row this script is not allowed to touch (restricted, current tier held as-is);
 * 'city' for a vicinity description; 'neighborhood' for a coordinates_only hit whose own SRC_ACCU
 * says it isn't parcel-accurate.
 */
export const NRHP_ADDRESS_TIER_TABLE = {
  addressFound: 'site',
  vicinity: 'city',
  coordinatesOnlyAccuracyThresholdMeters: 30,
  coordinatesOnlyWithinThreshold: 'site',
  coordinatesOnlyBeyondThreshold: 'neighborhood',
} as const;

export type NrhpTierProposal = {
  /** Precision tier to write, or null for outcomes this script never writes (no_match, and
   *  restricted when there is no existing tier to hold). */
  readonly tier: string | null;
  /** True when the row needs human/orchestrator attention beyond a mechanical write. */
  readonly flagged: boolean;
  readonly flagReason: string | null;
};

/** Reads only NRHP_ADDRESS_TIER_TABLE plus the row's own outcome/accuracy/current tier. */
export function proposeNrhpTier(
  outcome: NrhpAddressOutcome,
  accuracyMeters: number | null,
  currentTier: string | null,
): NrhpTierProposal {
  if (outcome === 'restricted') {
    return { tier: currentTier, flagged: true, flagReason: 'nps_restricted_address' };
  }
  if (outcome === 'address_found') {
    return { tier: NRHP_ADDRESS_TIER_TABLE.addressFound, flagged: false, flagReason: null };
  }
  if (outcome === 'vicinity') {
    return { tier: NRHP_ADDRESS_TIER_TABLE.vicinity, flagged: false, flagReason: null };
  }
  if (outcome === 'coordinates_only') {
    const within =
      accuracyMeters !== null &&
      accuracyMeters <= NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyAccuracyThresholdMeters;
    return {
      tier: within
        ? NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyWithinThreshold
        : NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyBeyondThreshold,
      flagged: false,
      flagReason: null,
    };
  }
  return { tier: null, flagged: false, flagReason: null }; // no_match
}
