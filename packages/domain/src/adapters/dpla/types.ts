/**
 * DPLA v2 discovery adapter types (BB-073).
 *
 * IMPORTANT — endpoint/shape-churn tolerance: DPLA's aggregation program is transitioning to
 * Cleveland Public Library starting July 2026 (per the bead's research basis). This adapter
 * therefore does NOT assume `api.dp.la/v2`'s current response shape is stable. Every field is
 * read defensively (client.ts's `parseDplaDoc`): known alternate field names/locations are
 * tried in order, a record that is missing the bare minimum (an id and a title) is rejected
 * (recorded, not thrown — one malformed/renamed field never poisons a whole batch), and no
 * code path assumes a field is present without a runtime type check. If DPLA v2 is retired in
 * favor of a new Cleveland-operated endpoint, only `client.ts`'s field-extraction functions and
 * `fetch-search.ts`'s URL builders should need to change — normalizer.ts and the BB-037 contract
 * wiring are shape-agnostic past that boundary.
 */
import type { AdapterCandidateRecord } from '../types.js';

export const DPLA_V2_ADAPTER_ID = 'dpla' as const;
export const DPLA_V2_PARSER_VERSION = 'dpla-v2-parser-1.0.0' as const;
export const DPLA_V2_STABLE_ID_SCHEME = 'dpla-v2-item' as const;
export const DPLA_V2_PAYLOAD_SCHEMA_VERSION = 'dpla-v2-payload.v1' as const;

/**
 * DPLA aggregates library/museum/archive metadata — closer to the federal DPLA fixture
 * adapter's `reputable_secondary` tier (../federal/dpla/definition.ts) than to raw community
 * UGC, since every record traces back to a contributing institution even when that institution
 * is a small local historical society. Kept distinct from `internet_archive`'s
 * `community_oral` default, which covers raw, unmediated uploads.
 */
export const DPLA_V2_DEFAULT_CLASSIFICATION = 'reputable_secondary' as const;

/** Normalized shape produced after defensively extracting fields from whatever DPLA (or its
 * Cleveland-operated successor) returns — see the module header for the tolerance rationale. */
export type DplaNormalizedDoc = {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly isShownAt?: string;
  readonly displayDate?: string;
  readonly providerName?: string;
  readonly subjects?: readonly string[];
};

export type DplaRejectedDoc = {
  readonly index: number;
  readonly reason: string;
};

export type DplaParsedBatch = {
  readonly docs: readonly DplaNormalizedDoc[];
  readonly rejected: readonly DplaRejectedDoc[];
  readonly count?: number;
};

export type DplaCandidatePayload = {
  readonly schemaVersion: typeof DPLA_V2_PAYLOAD_SCHEMA_VERSION;
  readonly dplaId: string;
  readonly providerName?: string;
  readonly displayDate?: string;
  readonly subjects?: readonly string[];
  /** Capped to the BB-077 evidence-pointer snippet limits — never the full item description. */
  readonly summary?: string;
};

export type DplaCandidateRecord = AdapterCandidateRecord & {
  readonly payload: DplaCandidatePayload;
};
