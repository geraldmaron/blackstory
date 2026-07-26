/**
 * Evidence capture core: turn a cited URL into a persisted bb_evidence.source_capture
 * (+ retrieval_event), through the SSRF-safe fetch path. Anti-rot, anti-spoof: a
 * capture proves what a source said, and its sha256, when we cited it.
 *
 * Everything with a side effect — the fetch, the blob store, the DB writes — is an
 * injected dependency, so the orchestration is unit-testable with fakes and the CLI
 * wires the real safe-fetch + Postgres + (optional) GCS/Wayback implementations.
 *
 * Storage note: executeSafeFetch never exposes raw bytes (it hashes then sandbox-parses
 * them), so a capture snapshot is the sanitized extracted text plus the sha256 of the
 * raw bytes. When no blob store is configured we persist metadata-only (hash + excerpt),
 * which still anchors the claim; a GCS writer can be injected to store the full snapshot.
 */
import type { SafeFetchResult } from '@repo/security/url-safety';

/** The three cited-URL surfaces the backfill walks. */
export type CaptureSurface = 'entity' | 'packet' | 'article';

export type CitedUrl = {
  readonly url: string;
  readonly surface: CaptureSurface;
  /** Stable id of the citing record (entity_id, packet observationId, article ref index). */
  readonly refId: string;
};

/**
 * Normalize a URL for dedup: lowercase scheme+host, drop the fragment, strip a trailing
 * slash on the path. Query is significant (it selects a table/download) so it is kept.
 * Returns null for anything that is not an http(s) URL.
 */
export function normalizeCaptureUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.protocol = parsed.protocol.toLowerCase();
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString();
}

export type SurfaceTally = { readonly cited: number; readonly unique: number };

export type CaptureInventory = {
  /** Deduped by normalized URL; the first-seen surface/refId wins. */
  readonly urls: readonly CitedUrl[];
  readonly bySurface: Readonly<Record<CaptureSurface, SurfaceTally>>;
};

const EMPTY_SURFACES: Record<CaptureSurface, { cited: number; unique: number }> = {
  entity: { cited: 0, unique: 0 },
  packet: { cited: 0, unique: 0 },
  article: { cited: 0, unique: 0 },
};

/** Collapse raw cited URLs from every surface into a deduped inventory with per-surface tallies. */
export function buildCaptureInventory(refs: readonly CitedUrl[]): CaptureInventory {
  const tally: Record<CaptureSurface, { cited: number; unique: number }> = {
    entity: { ...EMPTY_SURFACES.entity },
    packet: { ...EMPTY_SURFACES.packet },
    article: { ...EMPTY_SURFACES.article },
  };
  const seen = new Set<string>();
  const urls: CitedUrl[] = [];
  for (const ref of refs) {
    const normalized = normalizeCaptureUrl(ref.url);
    if (normalized === null) continue;
    tally[ref.surface].cited += 1;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tally[ref.surface].unique += 1;
    urls.push({ url: normalized, surface: ref.surface, refId: ref.refId });
  }
  return { urls, bySurface: tally };
}

// ---- persistence row shapes (mirror bb_evidence column shapes exactly) ----

export type SourceCaptureRow = {
  readonly id: string;
  readonly sourceItemId: string | null;
  readonly contentHashAlgorithm: 'sha256';
  readonly contentHashDigest: string;
  readonly parserVersion: string;
  readonly snapshotMode: 'selective';
  readonly dedupOfCaptureId: string | null;
  readonly storageObject: Record<string, unknown>;
  readonly capturedAt: string;
};

export type RetrievalEventRow = {
  readonly id: string;
  readonly sourceId: string;
  readonly adapterId: string;
  readonly status: 'success' | 'failure' | 'skipped_duplicate';
  readonly httpStatus: number | null;
  readonly detail: Record<string, unknown>;
  readonly occurredAt: string;
};

export type CaptureStorageObject = Record<string, unknown>;

/** Injected blob sink. Returns the jsonb value stored in source_captures.storage_object. */
export type CaptureStorage = {
  readonly kind: string;
  store(input: {
    readonly url: string;
    readonly sha256: string;
    readonly contentType: string;
    readonly byteLength: number;
    readonly text: string;
  }): Promise<CaptureStorageObject>;
};

/** Default sink: persist hash + excerpt inline, no external blob. Honest when GCS is absent. */
export function createMetadataOnlyStorage(excerptChars = 2000): CaptureStorage {
  return {
    kind: 'metadata-only',
    async store({ url, sha256, contentType, byteLength, text }) {
      return {
        stored: 'metadata-only',
        sourceUrl: url,
        sha256,
        contentType,
        byteLength,
        excerpt: text.slice(0, excerptChars),
      };
    },
  };
}

export type CaptureDeps = {
  readonly fetchUrl: (url: string) => Promise<SafeFetchResult>;
  readonly storage: CaptureStorage;
  readonly parserVersion: string;
  /** Deterministic id + clock for reproducible tests. */
  readonly newId: (prefix: string, seed: string) => string;
  readonly now: () => string;
};

export type CaptureOutcome = {
  readonly url: string;
  readonly surface: CaptureSurface;
  readonly refId: string;
  readonly status: 'success' | 'failure';
  readonly capture: SourceCaptureRow | null;
  readonly retrievalEvent: RetrievalEventRow;
};

/**
 * Capture one cited URL: safe-fetch it, and on success build a capture row (sha256 of
 * raw bytes, snapshot stored via the injected sink) plus a success retrieval event; on
 * failure, build only a failure retrieval event carrying the reason. No I/O beyond the
 * injected fetch + storage — the caller owns DB writes and dedup.
 */
export async function captureCitedUrl(ref: CitedUrl, deps: CaptureDeps): Promise<CaptureOutcome> {
  const occurredAt = deps.now();
  const result = await deps.fetchUrl(ref.url);

  if (!result.ok) {
    return {
      url: ref.url,
      surface: ref.surface,
      refId: ref.refId,
      status: 'failure',
      capture: null,
      retrievalEvent: {
        id: deps.newId('rev', `${ref.url}|fail|${occurredAt}`),
        sourceId: ref.refId,
        adapterId: 'capture-backfill',
        status: 'failure',
        httpStatus: null,
        detail: { url: ref.url, surface: ref.surface, reason: result.reason },
        occurredAt,
      },
    };
  }

  const storageObject = await deps.storage.store({
    url: ref.url,
    sha256: result.contentHash,
    contentType: result.contentType,
    byteLength: result.byteLength,
    text: result.parser.extractedText,
  });

  return {
    url: ref.url,
    surface: ref.surface,
    refId: ref.refId,
    status: 'success',
    capture: {
      id: deps.newId('cap', result.contentHash),
      sourceItemId: null,
      contentHashAlgorithm: 'sha256',
      contentHashDigest: result.contentHash,
      parserVersion: deps.parserVersion,
      snapshotMode: 'selective',
      dedupOfCaptureId: null,
      storageObject,
      capturedAt: occurredAt,
    },
    retrievalEvent: {
      id: deps.newId('rev', `${ref.url}|ok|${occurredAt}`),
      sourceId: ref.refId,
      adapterId: 'capture-backfill',
      status: 'success',
      httpStatus: 200,
      detail: {
        url: ref.url,
        surface: ref.surface,
        finalUrl: result.finalUrl,
        byteLength: result.byteLength,
        storage: deps.storage.kind,
      },
      occurredAt,
    },
  };
}
