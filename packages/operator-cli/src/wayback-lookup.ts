/**
 * Read-existing-captures fallback for capture-backfill, the counterpart to wayback-anchor.ts.
 * The anchor mints a snapshot through SPN2; this asks Internet Archive whether it already has
 * one. Two jobs, two files, because they differ in everything that matters: the lookup needs no
 * credentials, hits a different host, and is safe to run on a URL our own fetch could not read.
 *
 * Like the anchor it is an injected port, so capture-backfill's tests drive it with a fake and
 * never open a socket.
 */
import { lookupWaybackSnapshot, type SafeHttpClient, type WaybackLookupResult } from '@repo/domain';

export type WaybackLookup = {
  findSnapshot(targetUrl: string): Promise<WaybackLookupResult>;
};

export type CreateWaybackLookupInput = {
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly sleep?: (ms: number) => Promise<void>;
};

/** Builds a testable availability lookup. Production wires waybackSafeHttpClient; no keys needed. */
export function createWaybackLookup(input: CreateWaybackLookupInput): WaybackLookup {
  return {
    async findSnapshot(targetUrl: string): Promise<WaybackLookupResult> {
      return lookupWaybackSnapshot(input.client, targetUrl, {
        ...(input.retries !== undefined ? { retries: input.retries } : {}),
        ...(input.sleep !== undefined ? { sleep: input.sleep } : {}),
      });
    },
  };
}

/**
 * Merges a lookup outcome into one of the two jsonb bags a capture writes: a capture row's
 * `storage_object`, or a retrieval event's `detail`. One function for both, because the keys
 * have to agree. An operator reading a failure event and an operator reading the capture that
 * event belongs to should not have to learn two vocabularies.
 *
 * The keys stay clear of `attachWaybackMetadata`'s SPN keys (`waybackStatus`, `waybackReason`)
 * so a row can honestly record "looked, found an older snapshot, then minted a new one".
 * Availability pointers use their own names and never masquerade as the current revision's
 * `waybackCaptureUrl`.
 */
export function attachWaybackLookup(
  bag: Record<string, unknown>,
  result: WaybackLookupResult,
): Record<string, unknown> {
  if (result.status === 'found') {
    return {
      ...bag,
      waybackLookupStatus: 'found',
      waybackAvailabilityUrl: result.snapshot.url,
      waybackAvailabilityTimestamp: result.snapshot.timestamp,
      ...(result.snapshot.httpStatus !== undefined
        ? { waybackAvailabilityHttpStatus: result.snapshot.httpStatus }
        : {}),
      waybackAvailabilitySource: 'availability-lookup',
    };
  }
  return {
    ...bag,
    waybackLookupStatus: 'miss',
    waybackLookupReason: result.reason,
    ...(result.detail !== undefined ? { waybackLookupDetail: result.detail } : {}),
  };
}
