/**
 * capture-backfill: walk every cited URL across entities, packets, and articles and
 * capture each reachable one (sha256 + sanitized snapshot + retrieval_event), so the
 * corpus stops depending on live external URLs that rot, drift, or get spoofed.
 *
 * Safe by default: without --commit this only inventories and reports coverage; it
 * makes no outbound fetch and no DB write. --commit performs the SSRF-safe fetches and
 * persists rows. All I/O (DB, fetch) is injected so the lane is unit-testable.
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

/** Minimal query surface — the real pg.Pool satisfies it; tests inject a fake. */
export type CaptureDb = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

/** Pull cited URLs from the three surfaces. Entities are scoped to the active release. */
export async function collectCitedUrls(db: CaptureDb): Promise<CitedUrl[]> {
  const refs: CitedUrl[] = [];

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

  const articles = await db.query<{ ref_id: string; url: string }>(
    `SELECT a.id AS ref_id, ref->>'url' AS url
     FROM bb_reference.articles a
     CROSS JOIN LATERAL jsonb_array_elements(a."references") ref
     WHERE jsonb_typeof(a."references") = 'array' AND ref->>'url' IS NOT NULL`,
  );
  for (const row of articles.rows) {
    refs.push({ url: row.url, surface: 'article', refId: row.ref_id });
  }

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

  return refs;
}

export type BackfillOptions = {
  readonly commit: boolean;
  readonly maxCaptures?: number;
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
    [event.id, event.sourceId, event.adapterId, status, event.httpStatus, JSON.stringify(event.detail), event.occurredAt],
  );
  return { deduped };
}

export async function runCaptureBackfill(
  db: CaptureDb,
  options: BackfillOptions,
  captureDeps: CaptureDeps,
): Promise<BackfillReport> {
  const refs = await collectCitedUrls(db);
  const inventory = buildCaptureInventory(refs);
  const budget = options.maxCaptures ?? inventory.urls.length;
  const planned = Math.min(budget, inventory.urls.length);
  const target = inventory.urls.slice(0, planned);

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
    };
  }

  let captured = 0;
  let deduped = 0;
  let failed = 0;
  for (const ref of target) {
    perSurface[ref.surface].attempted += 1;
    const outcome = await captureCitedUrl(ref, captureDeps);
    const { deduped: wasDup } = await persistCapture(db, outcome.capture, outcome.retrievalEvent);
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
  };
}
