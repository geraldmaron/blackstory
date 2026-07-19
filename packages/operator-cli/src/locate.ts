/**
 * Operator locate: entity id + address/place text → Census geocode → validated
 * EntityLocation draft (and optional Firestore commit via commitWithAudit).
 * Thin caller over domain location-audit + census-geo; no LLM.
 */
import {
  US_STATES,
  buildEntityLocationFromResolution,
  buildCensusGeocodeQuery,
  classifyLocationEvidence,
  decideLocationCorrection,
  fetchCensusAddressGeocode,
  normalizeAddressInput,
  type EntityLocation,
  type LocationCorrectionDecision,
  type SafeHttpClient,
} from '@repo/domain';
import {
  commitWithAudit,
  type AtomicStore,
  type AuditEventDoc,
  type CommitWithAuditResult,
} from '@repo/firebase';
import { buildOperatorAuditEvent, buildOperatorOutboxMessage } from './audit.js';
import type { OperatorIdentity } from './identity.js';

export type LocateInput = {
  readonly entityId: string;
  readonly address: string;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision?: string;
  readonly locationId?: string;
  readonly role?: 'historical' | 'current' | 'approximate';
  /** When set, compare against this stored pin for drift decisions. */
  readonly stored?: { readonly lat: number; readonly lng: number };
  readonly recordedAt?: string;
};

export type LocateSuccess = {
  readonly ok: true;
  readonly decision: LocationCorrectionDecision;
  readonly location: EntityLocation;
  readonly cacheKey: string;
  readonly queryText: string;
};

export type LocateFailure = {
  readonly ok: false;
  readonly reason: string;
  readonly decision?: LocationCorrectionDecision;
};

export type LocateOutcome = LocateSuccess | LocateFailure;

export type LocateDependencies = {
  readonly client: SafeHttpClient;
};

const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));
const STATE_BY_POSTAL = new Map(US_STATES.map((s) => [s.postalCode, s]));

function stateFor(jurisdictionLabel: string) {
  const tail = jurisdictionLabel.split(',').pop()?.trim() ?? '';
  if (/^d\.?c\.?$/i.test(tail) || /district of columbia/i.test(tail)) {
    return STATE_BY_POSTAL.get('DC');
  }
  return STATE_BY_NAME.get(tail.toLowerCase()) ?? STATE_BY_POSTAL.get(tail.toUpperCase());
}

function outsideStateBbox(lat: number, lng: number, jurisdictionLabel: string): boolean {
  const state = stateFor(jurisdictionLabel);
  if (!state) return false;
  const [west, south, east, north] = state.bbox;
  return lat < south || lat > north || lng < west || lng > east;
}

/**
 * Resolve a location for one entity. Does not write — call `commitLocate` with `--commit`.
 */
export async function prepareLocate(
  input: LocateInput,
  deps: LocateDependencies,
): Promise<LocateOutcome> {
  const precision = input.locationPrecision ?? 'institution';
  const jurisdictionLabel = input.jurisdictionLabel ?? '';
  const query = jurisdictionLabel
    ? buildCensusGeocodeQuery(input.address, jurisdictionLabel)
    : buildCensusGeocodeQuery(input.address, '');
  const normalized = normalizeAddressInput(query);
  if (!normalized.queryText) {
    return { ok: false, reason: 'empty_address' };
  }

  const evidenceClass = classifyLocationEvidence({
    locationLabel: input.address,
    locationPrecision: precision,
  });

  let matches;
  try {
    matches = await fetchCensusAddressGeocode({
      address: normalized.queryText,
      client: deps.client,
    });
  } catch {
    return { ok: false, reason: 'geocoder_unavailable' };
  }

  if (matches.length === 0) {
    return { ok: false, reason: 'no_match' };
  }
  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous_match' };
  }
  const best = matches[0]!;

  const stored = input.stored ?? { lat: best.lat, lng: best.lng };
  const effectiveJurisdiction =
    jurisdictionLabel || [best.placeName, best.stateName].filter(Boolean).join(', ');

  const decision = decideLocationCorrection({
    entityId: input.entityId,
    locationLabel: input.address,
    locationPrecision: precision,
    jurisdictionLabel: effectiveJurisdiction,
    stored,
    outsideStateBbox: effectiveJurisdiction
      ? outsideStateBbox(stored.lat, stored.lng, effectiveJurisdiction)
      : false,
    geocode: {
      lat: best.lat,
      lng: best.lng,
      method: 'geocode_census',
      ...(best.matchedAddress ? { matchedAddress: best.matchedAddress } : {}),
      ...(best.stateName ? { stateName: best.stateName } : {}),
    },
  });

  if (decision.action === 'review' && !decision.corrected) {
    return { ok: false, reason: decision.reason, decision };
  }

  const lat = decision.corrected?.lat ?? best.lat;
  const lng = decision.corrected?.lng ?? best.lng;
  const resolvedPrecision =
    decision.action === 'downgrade_precision' ? decision.suggestedPrecision : precision;

  const location = buildEntityLocationFromResolution({
    locationId: input.locationId ?? `loc_${input.entityId}_primary`,
    entityId: input.entityId,
    lat,
    lng,
    precision: resolvedPrecision,
    label: input.address,
    ...(input.role ? { role: input.role } : {}),
    matchMethod: 'geocode_census',
    evidenceClass,
    ...(best.matchedAddress ? { matchedAddress: best.matchedAddress } : {}),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  });

  return {
    ok: true,
    decision,
    location,
    cacheKey: normalized.cacheKey,
    queryText: normalized.queryText,
  };
}

export type CommitLocateInput = {
  readonly outcome: LocateSuccess;
  readonly identity: OperatorIdentity;
  readonly now?: string;
};

/** Persist EntityLocation under canonicalEntities/{entityId}/locations/{locationId}. */
export async function commitLocate(
  store: AtomicStore,
  input: CommitLocateInput,
): Promise<CommitWithAuditResult> {
  const { location } = input.outcome;
  const now = input.now ?? new Date().toISOString();
  const path = `canonicalEntities/${location.entityId}/locations/${location.id}`;
  const idempotencyKey = `locate:${location.entityId}:${location.id}:${location.point?.geohash ?? 'nogeo'}`;

  const auditEvent = buildOperatorAuditEvent({
    action: 'research.updated',
    subject: { type: 'canonicalEntities', id: location.entityId, path },
    identity: input.identity,
    reason: `Census-geocoded EntityLocation for ${location.entityId}`,
    now,
    idempotencyKey,
    entityId: location.entityId,
    data: {
      locationId: location.id,
      matchMethod: location.match?.method,
      precision: location.precision,
      cacheKey: input.outcome.cacheKey,
    },
  });
  const outboxMessage = buildOperatorOutboxMessage({
    auditEvent,
    topic: 'operator.entity_location.upserted',
    aggregateType: 'canonicalEntities',
    aggregateId: location.entityId,
    payload: { locationId: location.id, path },
    now,
  });

  return commitWithAudit(store, {
    mutations: [
      {
        operation: 'set',
        path,
        data: location as unknown as Readonly<Record<string, unknown>>,
      },
    ],
    auditEvent: auditEvent as unknown as AuditEventDoc,
    outboxMessage,
  });
}
