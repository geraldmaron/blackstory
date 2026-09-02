/**
 * capture-backfill: walk every cited URL across entities, packets, and articles and
 * capture each reachable one (sha256 + sanitized snapshot + retrieval_event), so the
 * corpus stops depending on live external URLs that rot, drift, or get spoofed.
 *
 * Safe by default: without --commit this only inventories and reports coverage; it
 * makes no outbound fetch and no DB write. --commit performs the SSRF-safe fetches and
 * persists rows. --wayback optionally POSTs each successful local capture to Wayback
 * SPN2 and stores the snapshot URL on storage_object; missing keys skip SPN.
 * All I/O (DB, fetch, Wayback) is injected so the lane is unit-testable.
 */
import {
  buildCaptureInventory,
  captureCitedUrl,
  type CaptureDeps,
  type CaptureSurface,
  type CitedUrl,
  sourceIdForUrl,
  type SourceCaptureRow,
  type RetrievalEventRow,
} from './source-capture.js';
import { attachWaybackMetadata } from './wayback-anchor.js';

/** Minimal query surface — the real pg.Pool satisfies it; tests inject a fake. */
export type CaptureDb = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

/** Pull cited URLs from the three surfaces. Entities are scoped to the active release. */
export async function collectCitedUrls(
  db: CaptureDb,
  options: { readonly surfaces?: readonly CaptureSurface[] } = {},
): Promise<CitedUrl[]> {
  const allowed = options.surfaces ? new Set(options.surfaces) : null;
  const refs: CitedUrl[] = [];

  if (!allowed || allowed.has('packet')) {
    const packets = await db.query<{ ref_id: string; url: string }>(
      `SELECT obs->>'observationId' AS ref_id, obs->'provenance'->>'sourceUrl' AS url
       FROM bb_reference.theme_impact_packets p
       CROSS JOIN LATERAL jsonb_array_elements(p.observations) obs
       WHERE jsonb_typeof(p.observations) = 'array'
         AND obs->'provenance'->>'sourceUrl' IS NOT NULL`,
    );
    for (const row of packets.rows) {
      refs.push({ url: row.url, surface: 'packet', refId: row.ref_id ?? 'packet' });
    }
  }

  if (!allowed || allowed.has('article')) {
    const articles = await db.query<{ ref_id: string; url: string }>(
      `SELECT a.id AS ref_id, ref->>'url' AS url
       FROM bb_reference.articles a
       CROSS JOIN LATERAL jsonb_array_elements(a."references") ref
       WHERE jsonb_typeof(a."references") = 'array' AND ref->>'url' IS NOT NULL`,
    );
    for (const row of articles.rows) {
      refs.push({ url: row.url, surface: 'article', refId: row.ref_id });
    }
  }

  if (!allowed || allowed.has('entity')) {
    const entities = await db.query<{ ref_id: string; url: string }>(
      `SELECT re.entity_id AS ref_id, c.url
       FROM bb_public.active_release ar
       JOIN bb_public.release_entities re ON re.release_id = ar.release_id
       CROSS JOIN LATERAL jsonb_array_elements(re.claims) claim
       CROSS JOIN LATERAL (VALUES (claim->>'citationHref'), (claim->>'citationSource')) AS c(url)
       WHERE ar.id = 'active' AND jsonb_typeof(re.claims) = 'array' AND c.url IS NOT NULL`,
    );
    for (const row of entities.rows) {
      refs.push({ url: row.url, surface: 'entity', refId: row.ref_id });
    }
  }

  return refs;
}

/** All unique cited URLs belonging to the first `maxEntities` entity ids, in inventory order. */
export function selectUrlsForEntityBatch(
  urls: readonly CitedUrl[],
  maxEntities: number,
): { readonly urls: readonly CitedUrl[]; readonly entityCount: number } {
  if (maxEntities < 0) {
    throw new Error('maxEntities must be a non-negative integer');
  }
  const selectedIds = new Set<string>();
  const selected: CitedUrl[] = [];
  for (const url of urls) {
    if (url.surface !== 'entity') continue;
    if (!selectedIds.has(url.refId)) {
      if (selectedIds.size >= maxEntities) continue;
      selectedIds.add(url.refId);
    }
    selected.push(url);
  }
  return { urls: selected, entityCount: selectedIds.size };
}

export type BackfillOptions = {
  readonly commit: boolean;
  readonly maxCaptures?: number;
  /** Request SPN2 secondary anchoring. Requires waybackAnchor on CaptureDeps to run. */
  readonly wayback?: boolean;
  /** Capture cited URLs for the first N unique entity ids (entity surface only). */
  readonly maxEntities?: number;
};

export type WaybackBackfillReport = {
  readonly requested: boolean;
  readonly status: 'off' | 'planned' | 'skipped_no_credentials' | 'ran';
  readonly credentialsPresent: boolean;
  readonly attempted: number;
  readonly anchored: number;
  readonly failed: number;
};

export type BackfillReport = {
  readonly mode: 'dry-run' | 'commit';
  readonly storage: string;
  readonly inventory: ReturnType<typeof buildCaptureInventory>['bySurface'];
  readonly totalUnique: number;
  readonly planned: number;
  readonly attempted: number;
  readonly captured: number;
  readonly deduped: number;
  readonly failed: number;
  /** Capture rate over attempted URLs; the target is reported, not hardcoded as a gate. */
  readonly captureRate: number | null;
  readonly perSurface: Record<CaptureSurface, { attempted: number; captured: number }>;
  readonly wayback: WaybackBackfillReport;
  readonly plannedEntities?: number;
};

/** Persist one capture + its retrieval event; DB dedups on (algorithm, digest). */
export async function persistCapture(
  db: CaptureDb,
  capture: SourceCaptureRow | null,
  event: RetrievalEventRow,
): Promise<{ deduped: boolean }> {
  let deduped = false;
  if (capture) {
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO bb_evidence.source_captures
         (id, source_item_id, content_hash_algorithm, content_hash_digest, parser_version,
          snapshot_mode, dedup_of_capture_id, storage_object, captured_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz, now())
       ON CONFLICT (content_hash_algorithm, content_hash_digest) DO NOTHING
       RETURNING id`,
      [
        capture.id,
        capture.sourceItemId,
        capture.contentHashAlgorithm,
        capture.contentHashDigest,
        capture.parserVersion,
        capture.snapshotMode,
        capture.dedupOfCaptureId,
        JSON.stringify(capture.storageObject),
        capture.capturedAt,
      ],
    );
    deduped = inserted.rows.length === 0;
  }
  const status = deduped ? 'skipped_duplicate' : event.status;
  // retrieval_events.source_id is a FK into the per-hostname evidence_sources registry,
  // so register the host before the event insert or the FK rejects the whole capture.
  const source = sourceIdForUrl(String(event.detail.url ?? ''));
  if (source && source.id === event.sourceId) {
    await db.query(
      `INSERT INTO bb_evidence.evidence_sources (id, display_name, adapter_id, adapter_enabled)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (id) DO NOTHING`,
      [source.id, source.hostname, event.adapterId],
    );
  }
  await db.query(
    `INSERT INTO bb_evidence.retrieval_events
       (id, source_id, adapter_id, status, http_status, detail, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      event.sourceId,
      event.adapterId,
      status,
      event.httpStatus,
      JSON.stringify(event.detail),
      event.occurredAt,
    ],
  );
  return { deduped };
}

function resolveWaybackReport(input: {
  readonly requested: boolean;
  readonly credentialsPresent: boolean;
  readonly commit: boolean;
  readonly attempted: number;
  readonly anchored: number;
  readonly failed: number;
}): WaybackBackfillReport {
  let status: WaybackBackfillReport['status'] = 'off';
  if (input.requested && !input.credentialsPresent) {
    status = 'skipped_no_credentials';
  } else if (input.requested && !input.commit) {
    status = 'planned';
  } else if (input.requested) {
    status = 'ran';
  }
  return {
    requested: input.requested,
    status,
    credentialsPresent: input.credentialsPresent,
    attempted: input.attempted,
    anchored: input.anchored,
    failed: input.failed,
  };
}

export async function runCaptureBackfill(
  db: CaptureDb,
  options: BackfillOptions,
  captureDeps: CaptureDeps,
): Promise<BackfillReport> {
  const entityBatch = options.maxEntities !== undefined;
  const refs = await collectCitedUrls(db, entityBatch ? { surfaces: ['entity'] } : {});
  const inventory = buildCaptureInventory(refs);
  const batch =
    options.maxEntities !== undefined
      ? selectUrlsForEntityBatch(inventory.urls, options.maxEntities)
      : { urls: inventory.urls, entityCount: undefined };
  const budget = options.maxCaptures ?? batch.urls.length;
  const target = batch.urls.slice(0, budget);
  const planned = target.length;
  const waybackRequested = options.wayback === true;
  const credentialsPresent = captureDeps.waybackAnchor !== undefined;

  const perSurface: Record<CaptureSurface, { attempted: number; captured: number }> = {
    entity: { attempted: 0, captured: 0 },
    packet: { attempted: 0, captured: 0 },
    article: { attempted: 0, captured: 0 },
  };

  if (!options.commit) {
    return {
      mode: 'dry-run',
      storage: captureDeps.storage.kind,
      inventory: inventory.bySurface,
      totalUnique: inventory.urls.length,
      planned,
      attempted: 0,
      captured: 0,
      deduped: 0,
      failed: 0,
      captureRate: null,
      perSurface,
      wayback: resolveWaybackReport({
        requested: waybackRequested,
        credentialsPresent,
        commit: false,
        attempted: 0,
        anchored: 0,
        failed: 0,
      }),
      ...(batch.entityCount !== undefined ? { plannedEntities: batch.entityCount } : {}),
    };
  }

  let captured = 0;
  let deduped = 0;
  let failed = 0;
  let waybackAttempted = 0;
  let waybackAnchored = 0;
  let waybackFailed = 0;
  const waybackAnchor = waybackRequested ? captureDeps.waybackAnchor : undefined;

  for (const ref of target) {
    perSurface[ref.surface].attempted += 1;
    const outcome = await captureCitedUrl(ref, captureDeps);
    let capture = outcome.capture;
    if (waybackAnchor && capture) {
      waybackAttempted += 1;
      const attempt = await waybackAnchor.captureUrl(ref.url);
      if (attempt.status === 'anchored') {
        waybackAnchored += 1;
      } else {
        waybackFailed += 1;
      }
      capture = {
        ...capture,
        storageObject: attachWaybackMetadata(capture.storageObject, attempt),
      };
    }
    const { deduped: wasDup } = await persistCapture(db, capture, outcome.retrievalEvent);
    if (outcome.status === 'failure') {
      failed += 1;
    } else if (wasDup) {
      deduped += 1;
    } else {
      captured += 1;
      perSurface[ref.surface].captured += 1;
    }
  }

  const attempted = target.length;
  return {
    mode: 'commit',
    storage: captureDeps.storage.kind,
    inventory: inventory.bySurface,
    totalUnique: inventory.urls.length,
    planned,
    attempted,
    captured,
    deduped,
    failed,
    captureRate: attempted > 0 ? Number(((captured + deduped) / attempted).toFixed(3)) : null,
    perSurface,
    wayback: resolveWaybackReport({
      requested: waybackRequested,
      credentialsPresent,
      commit: true,
      attempted: waybackAttempted,
      anchored: waybackAnchored,
      failed: waybackFailed,
    }),
    ...(batch.entityCount !== undefined ? { plannedEntities: batch.entityCount } : {}),
  };
}
