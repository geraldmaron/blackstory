
/**
 * Real safe-fetch dependencies (DNS pinning + HTTP transport) plus citation prefill
 * and a capture-plan preview for the admin quick-add surface and the CLI's URL-based intake.
 *
 * This module never fetches a URL directly. It only supplies the dependency-injected
 * `resolveHost`/`transport` that `executeSafeFetch` (packages/security/src/url-safety/fetch.ts)
 * requires, and calls that real function the SSRF-safe DNS pinning, redirect re-validation,
 * response-size/content-type limits, and sandboxed parsing all stay in `@blap/security`.
 *
 * Wayback capture: NOT wired. Nothing in this repo calls the Internet Archive's Save Page Now
 * API yet (see `packages/domain/src/provenance/capture.ts` `SourceCapture.snapshotStorageObject`
 * models a pointer to a *selective* stored snapshot, but no writer populates it from Wayback).
 * `planSelectiveCapture` below only documents where that call would go; it never fakes one.
 */
import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  DEFAULT_SAFE_FETCH_LIMITS,
  executeSafeFetch,
  type PinnedTransport,
  type PinnedTransportResponse,
  type ResolveHost,
  type SafeFetchDependencies,
  type SafeFetchOptions,
  type SafeFetchResult,
} from '@blap/security';
import type { SnapshotMode } from '@blap/domain';

/** Resolves a hostname to its public/private-classified addresses via the real system resolver. */
export const nodeResolveHost: ResolveHost = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 }));
};

function normalizeHeaders(headers: IncomingMessage['headers']): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return normalized;
}


/**
 * Connects directly to `pinnedAddress` (never re-resolves the hostname) while retaining
 * `hostname` for the TLS SNI/Host header, exactly as `executeSafeFetch` requires.
 */
export const nodePinnedTransport: PinnedTransport = (pinnedRequest) =>
  new Promise<PinnedTransportResponse>((resolve, reject) => {
    const target = new URL(pinnedRequest.url);
    const requester = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const clientRequest = requester(
      {
        host: pinnedRequest.pinnedAddress,
        port: pinnedRequest.port,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers: pinnedRequest.headers,
        servername: target.protocol === 'https:' ? pinnedRequest.hostname : undefined,
        signal: pinnedRequest.signal,
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          headers: normalizeHeaders(response.headers),
          remoteAddress: clientRequest.socket?.remoteAddress ?? pinnedRequest.pinnedAddress,
          body: response,
        });
      },
    );
    clientRequest.on('error', reject);
    clientRequest.end();
  });

/** Builds real, network-capable safe-fetch dependencies; override any part for tests. */
export function createNodeSafeFetchDependencies(
  overrides: Partial<SafeFetchDependencies> = {},
): SafeFetchDependencies {
  return {
    resolveHost: overrides.resolveHost ?? nodeResolveHost,
    transport: overrides.transport ?? nodePinnedTransport,
    ...(overrides.parser ? { parser: overrides.parser } : {}),
    ...(overrides.now ? { now: overrides.now } : {}),
  };
}

/** Runs one -safe fetch. Thin call-through to `executeSafeFetch` no policy logic here. */
export async function runQuickAddFetch(
  url: string,
  dependencies: SafeFetchDependencies = createNodeSafeFetchDependencies(),
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  return executeSafeFetch(url, dependencies, {
    limits: { ...DEFAULT_SAFE_FETCH_LIMITS, ...options.limits },
    ...(options.domainPolicy ? { domainPolicy: options.domainPolicy } : {}),
  });
}

export type CitationPrefill = {
  readonly sourceUrl: string;
  readonly fetchedAt: string;
  readonly contentHash: string;
  readonly contentType: string;
  /** Best-effort heuristic from the parser's stripped text not a true `<title>` extraction;
   * `executeSafeFetch`'s sandbox parser discards markup before this package ever sees it. */
  readonly suggestedTitle: string;
  readonly excerpt: string;
};

function deriveSuggestedTitle(extractedText: string, maxLength = 120): string {
  const firstLine = extractedText.split(/(?<=[.!?])\s|\n/u)[0]?.trim() ?? '';
  const trimmed = firstLine || extractedText.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Pre-fills citation metadata from a successful safe-fetch result. Pure no I/O. */
export function buildCitationPrefill(
  url: string,
  result: Extract<SafeFetchResult, { ok: true }>,
  now: string = new Date().toISOString(),
): CitationPrefill {
  return {
    sourceUrl: url,
    fetchedAt: now,
    contentHash: result.contentHash,
    contentType: result.contentType,
    suggestedTitle: deriveSuggestedTitle(result.parser.extractedText),
    excerpt: result.parser.extractedText.slice(0, 500),
  };
}

export type CapturePlan = {
  readonly snapshotMode: SnapshotMode;
  readonly waybackIntegration: 'not_wired';
  readonly contentHash: string;
  readonly notes: string;
};


/**
 * Documents where a Wayback (or other archival) capture would be triggered for this fetch.
 * Deliberately does NOT call any archival API see the module doc comment above.
 */
export function planSelectiveCapture(
  result: Extract<SafeFetchResult, { ok: true }>,
): CapturePlan {
  return {
    snapshotMode: 'selective',
    waybackIntegration: 'not_wired',
    contentHash: result.contentHash,
    notes:
      'No Wayback/Save-Page-Now call is made. When a real archival writer exists, it should ' +
      'populate SourceCapture.snapshotStorageObject (packages/domain/src/provenance/capture.ts) ' +
      'via buildCaptureAfterDedup once this proposal is promoted to a registered source item.',
  };
}
