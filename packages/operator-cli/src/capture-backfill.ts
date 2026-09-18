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
 *
 * Wayback is consulted read-first. A URL our safe-fetch cannot read (a PDF, a robots block,
 * a host that no longer answers) is exactly the URL most likely to already have a snapshot,
 * so a local failure triggers an availability lookup and the pointer lands on the failure
 * event instead of the event being a dead end. An availability hit is historical evidence,
 * not proof that the current content revision was saved: --wayback still submits or resumes
 * the current URL + content-hash job. A lookup miss is recorded and stepped past, never raised.
 */
import { indexCaptureText } from './evidence-retrieval.js';
import { assertContract } from '@repo/research-kernel';
import { createHash } from 'node:crypto';
import type { WaybackLookupResult } from '@repo/domain';
import {
  buildCaptureInventory,
  captureCitedUrl,
  normalizeCaptureUrl,
  type CaptureDeps,
  type CaptureSurface,
  type CitedUrl,
  sourceIdForUrl,
  type SourceCaptureRow,
  type RetrievalEventRow,
} from './source-capture.js';
import { attachWaybackMetadata } from './wayback-anchor.js';
import { attachWaybackLookup } from './wayback-lookup.js';

/** Minimal query surface — the real pg.Pool satisfies it; tests inject a fake. */
type CaptureQuery = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export type CaptureDb = CaptureQuery & {
  connect(): Promise<CaptureQuery & { release(): void }>;
};

/** Commit runs without an explicit entity/count bound stop after this many cited URLs. */
export const DEFAULT_COMMIT_CAPTURE_LIMIT = 25;

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
       FROM reference.theme_impact_packets p
       CROSS JOIN LATERAL jsonb_array_elements(p.observations) obs
       WHERE jsonb_typeof(p.observations) = 'array'
         AND obs->'provenance'->>'sourceUrl' IS NOT NULL
       ORDER BY url ASC, ref_id ASC`,
    );
    for (const row of packets.rows) {
      refs.push({ url: row.url, surface: 'packet', refId: row.ref_id ?? 'packet' });
    }
  }

  if (!allowed || allowed.has('article')) {
    const articles = await db.query<{ ref_id: string; url: string }>(
      `SELECT a.id AS ref_id, ref->>'url' AS url
       FROM reference.articles a
       CROSS JOIN LATERAL jsonb_array_elements(a."references") ref
       WHERE jsonb_typeof(a."references") = 'array' AND ref->>'url' IS NOT NULL
       ORDER BY url ASC, ref_id ASC`,
    );
    for (const row of articles.rows) {
      refs.push({ url: row.url, surface: 'article', refId: row.ref_id });
    }
  }

  if (!allowed || allowed.has('entity')) {
    const entities = await db.query<{ ref_id: string; url: string }>(
      `SELECT re.entity_id AS ref_id, c.url
       FROM published.active_release ar
       JOIN published.release_entities re ON re.release_id = ar.release_id
       CROSS JOIN LATERAL jsonb_array_elements(re.claims) claim
       CROSS JOIN LATERAL (VALUES (claim->>'citationHref')) AS c(url)
       WHERE ar.id = 'active' AND jsonb_typeof(re.claims) = 'array'
         AND claim->>'citationHref' IS NOT NULL
       ORDER BY url ASC, ref_id ASC`,
    );
    for (const row of entities.rows) {
      refs.push({ url: row.url, surface: 'entity', refId: row.ref_id });
    }
  }

  return refs;
}

/** All cited URLs belonging to the first `maxEntities` entity ids in stable id/URL order. */
export function selectUrlsForEntityBatch(
  urls: readonly CitedUrl[],
  maxEntities: number,
): { readonly urls: readonly CitedUrl[]; readonly entityCount: number } {
  if (maxEntities < 0) {
    throw new Error('maxEntities must be a non-negative integer');
  }
  const selectedIds = new Set<string>();
  const selected: CitedUrl[] = [];
  const candidates = urls
    .filter((url) => url.surface === 'entity')
    .sort((left, right) => {
      if (left.refId !== right.refId) return left.refId < right.refId ? -1 : 1;
      return left.url < right.url ? -1 : left.url > right.url ? 1 : 0;
    });
  for (const url of candidates) {
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
  /** Capture one explicitly reviewed URL; it must exist in the cited inventory. */
  readonly targetUrl?: string;
  /** Resume strictly after this normalized URL in the deterministic inventory. */
  readonly afterUrl?: string;
  /** Required for cursor resume; rejects continuation if the full URL inventory changed. */
  readonly inventoryFingerprint?: string;
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
  readonly pending: number;
};

export type WaybackLookupBackfillReport = {
  /** Whether a lookup port was injected at all. No credentials are involved, unlike SPN. */
  readonly available: boolean;
  readonly attempted: number;
  readonly found: number;
  readonly missed: number;
  /** Lookups that recovered a pointer for a URL our own fetch could not read. */
  readonly recoveredAfterFetchFailure: number;
};

export type BackfillReport = {
  readonly mode: 'dry-run' | 'commit';
  readonly storage: string;
  readonly inventory: ReturnType<typeof buildCaptureInventory>['bySurface'];
  readonly totalUnique: number;
  readonly inventoryFingerprint: string;
  readonly afterUrl?: string;
  readonly targetUrl?: string;
  readonly planned: number;
  readonly remaining: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  /** URLs whose local capture failed; use --url for an explicit retry. */
  readonly failedUrls: readonly string[];
  readonly attempted: number;
  readonly captured: number;
  readonly deduped: number;
  readonly failed: number;
  /** Capture rate over attempted URLs; the target is reported, not hardcoded as a gate. */
  readonly captureRate: number | null;
  /** Successful fetches do not establish persisted full-source coverage. */
  readonly representationCounts: {
    metadataOnly: number;
    extractedText: number;
    archivePointers: number;
  };
  readonly perSurface: Record<CaptureSurface, { attempted: number; captured: number }>;
  readonly wayback: WaybackBackfillReport;
  readonly waybackLookup: WaybackLookupBackfillReport;
  readonly plannedEntities?: number;
};

function compareUrls(left: CitedUrl, right: CitedUrl): number {
  return left.url < right.url ? -1 : left.url > right.url ? 1 : 0;
}

/** Stable fingerprint of the full normalized URL denominator, independent of SQL row order. */
export function captureInventoryFingerprint(urls: readonly CitedUrl[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...urls].sort(compareUrls).map((row) => row.url)))
    .digest('hex');
}

/** Atomically persist capture origin, passages and retrieval event; bytes deduplicate by hash. */
export async function persistCapture(
  pool: Pick<CaptureDb, 'connect'>,
  capture: SourceCaptureRow | null,
  event: RetrievalEventRow,
  role?: 'research_worker',
): Promise<{ deduped: boolean }> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    if (role === 'research_worker') await db.query('SET LOCAL ROLE research_worker');
    await db.query("SET LOCAL statement_timeout='30s'");
    let deduped = false;
    let captureId: string | null = null;
    const source = sourceIdForUrl(String(event.detail.url ?? ''));
    if (!source || source.id !== event.sourceId)
      throw new Error('Capture origin requires its exact source URL');
    await db.query(
      `INSERT INTO evidence.evidence_sources (id,display_name,adapter_id,adapter_enabled)
    VALUES ($1,$2,$3,false) ON CONFLICT (id) DO NOTHING`,
      [source.id, source.hostname, event.adapterId],
    );
    if (capture) {
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO evidence.source_captures
         (id,source_item_id,content_hash_algorithm,content_hash_digest,parser_version,
          snapshot_mode,dedup_of_capture_id,storage_object,captured_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::timestamptz,now())
       ON CONFLICT (content_hash_algorithm,content_hash_digest) DO NOTHING RETURNING id`,
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
      captureId =
        inserted.rows[0]?.id ??
        (
          await db.query<{ id: string }>(
            'SELECT id FROM evidence.source_captures WHERE content_hash_algorithm=$1 AND content_hash_digest=$2',
            [capture.contentHashAlgorithm, capture.contentHashDigest],
          )
        ).rows[0]?.id ??
        null;
      if (!captureId) throw new Error('Capture persistence did not resolve a content identity');
      const url = String(event.detail.url);
      const itemId = `src_item_${createHash('sha256').update(url).digest('hex')}`;
      await db.query(
        `INSERT INTO evidence.source_items (id,source_id,stable_identifier,url)
      VALUES ($1,$2,$3,$3) ON CONFLICT (source_id,stable_identifier) DO NOTHING`,
        [itemId, source.id, url],
      );
      const originWrite = await db.query<{ source_item_id: string }>(
        `INSERT INTO evidence.capture_origins
      (capture_id,source_item_id,source_url,final_url,storage_object,observed_at)
      SELECT $1,id,$3,$4,$5::jsonb,$6::timestamptz FROM evidence.source_items WHERE source_id=$2 AND stable_identifier=$3
      ON CONFLICT (capture_id,source_item_id) DO UPDATE SET
        storage_object=EXCLUDED.storage_object,observed_at=EXCLUDED.observed_at,final_url=EXCLUDED.final_url
      WHERE evidence.capture_origins.retention_revoked_at IS NULL RETURNING source_item_id`,
        [
          captureId,
          source.id,
          url,
          event.detail.finalUrl ?? url,
          JSON.stringify(capture.storageObject),
          event.occurredAt,
        ],
      );
      if (!originWrite.rows[0]) throw new Error('Capture origin retention was withdrawn');
      const decision = capture.storageObject.preservationDecision;
      if (
        decision &&
        typeof decision === 'object' &&
        'allowTextRetention' in decision &&
        decision.allowTextRetention === true &&
        capture.extractedText
      ) {
        await indexCaptureText(db, {
          captureId,
          sourceItemId: originWrite.rows[0]?.source_item_id ?? itemId,
          parserVersion: capture.parserVersion,
          text: capture.extractedText,
          decision: assertContract('PreservationDecision', decision),
        });
      }
    }
    const status = deduped ? 'skipped_duplicate' : event.status;
    await db.query(
      `INSERT INTO evidence.retrieval_events
       (id, source_id, adapter_id, status, http_status, detail, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.sourceId,
        event.adapterId,
        status,
        event.httpStatus,
        JSON.stringify({ ...event.detail, captureId }),
        event.occurredAt,
      ],
    );
    await db.query('COMMIT');
    return { deduped };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

function resolveWaybackReport(input: {
  readonly requested: boolean;
  readonly credentialsPresent: boolean;
  readonly commit: boolean;
  readonly attempted: number;
  readonly anchored: number;
  readonly failed: number;
  readonly pending: number;
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
    pending: input.pending,
  };
}

export async function runCaptureBackfill(
  db: CaptureDb,
  options: BackfillOptions,
  captureDeps: CaptureDeps,
): Promise<BackfillReport> {
  if (
    options.targetUrl !== undefined &&
    (options.afterUrl !== undefined ||
      options.maxCaptures !== undefined ||
      options.maxEntities !== undefined)
  ) {
    throw new Error('targetUrl cannot be combined with capture batch or cursor options');
  }
  if (options.maxEntities !== undefined && options.afterUrl !== undefined) {
    throw new Error(
      'afterUrl cannot be combined with maxEntities; entity batches are not resumable',
    );
  }
  if (options.afterUrl !== undefined && options.inventoryFingerprint === undefined) {
    throw new Error('afterUrl requires the prior inventoryFingerprint');
  }
  const refs = await collectCitedUrls(db);
  const inventory = buildCaptureInventory(refs);
  const batch =
    options.maxEntities !== undefined
      ? selectUrlsForEntityBatch(refs, options.maxEntities)
      : { urls: inventory.urls, entityCount: undefined };
  for (const bound of [options.maxEntities, options.maxCaptures]) {
    if (bound !== undefined && (!Number.isSafeInteger(bound) || bound < 0))
      throw new Error('Capture limits must be nonnegative integers');
  }
  const uniqueBatch = buildCaptureInventory(batch.urls);
  const sortedInventory = [...inventory.urls].sort(compareUrls);
  const sortedBatch = [...uniqueBatch.urls].sort(compareUrls);
  const inventoryFingerprint = captureInventoryFingerprint(sortedInventory);
  if (
    options.inventoryFingerprint !== undefined &&
    options.inventoryFingerprint !== inventoryFingerprint
  ) {
    throw new Error(
      `Capture inventory changed: expected ${options.inventoryFingerprint}, got ${inventoryFingerprint}`,
    );
  }
  let afterUrl: string | undefined;
  if (options.afterUrl !== undefined) {
    const normalized = normalizeCaptureUrl(options.afterUrl);
    if (normalized === null) throw new Error('afterUrl must be an HTTP(S) URL');
    afterUrl = normalized;
  }
  if (afterUrl !== undefined && !sortedInventory.some((row) => row.url === afterUrl)) {
    throw new Error(`afterUrl is not present in the selected capture inventory: ${afterUrl}`);
  }
  let targetUrl: string | undefined;
  if (options.targetUrl !== undefined) {
    const normalized = normalizeCaptureUrl(options.targetUrl);
    if (normalized === null) throw new Error('targetUrl must be an HTTP(S) URL');
    targetUrl = normalized;
  }
  const exactTarget =
    targetUrl === undefined ? undefined : sortedInventory.find((row) => row.url === targetUrl);
  if (targetUrl !== undefined && exactTarget === undefined) {
    throw new Error(`targetUrl is not present in the cited capture inventory: ${targetUrl}`);
  }
  const remainingBatch = exactTarget
    ? [exactTarget]
    : afterUrl === undefined
      ? sortedBatch
      : sortedInventory.filter((row) => row.url > afterUrl);
  const budget =
    options.maxCaptures ??
    (options.commit && options.maxEntities === undefined && targetUrl === undefined
      ? DEFAULT_COMMIT_CAPTURE_LIMIT
      : uniqueBatch.urls.length);
  const target = remainingBatch.slice(0, budget);
  const planned = target.length;
  const remaining = remainingBatch.length - planned;
  const hasMore = remaining > 0;
  const nextCursor = hasMore ? target.at(-1)?.url : undefined;
  const waybackRequested = options.wayback === true;
  const credentialsPresent = captureDeps.waybackAnchor !== undefined;
  const lookupAvailable = captureDeps.waybackLookup !== undefined;

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
      inventoryFingerprint,
      ...(afterUrl !== undefined ? { afterUrl } : {}),
      ...(targetUrl !== undefined ? { targetUrl } : {}),
      planned,
      remaining,
      hasMore,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
      failedUrls: [],
      attempted: 0,
      captured: 0,
      deduped: 0,
      failed: 0,
      captureRate: null,
      representationCounts: { metadataOnly: 0, extractedText: 0, archivePointers: 0 },
      perSurface,
      wayback: resolveWaybackReport({
        requested: waybackRequested,
        credentialsPresent,
        commit: false,
        attempted: 0,
        anchored: 0,
        failed: 0,
        pending: 0,
      }),
      waybackLookup: {
        available: lookupAvailable,
        attempted: 0,
        found: 0,
        missed: 0,
        recoveredAfterFetchFailure: 0,
      },
      ...(batch.entityCount !== undefined ? { plannedEntities: batch.entityCount } : {}),
    };
  }

  const representationCounts = { metadataOnly: 0, extractedText: 0, archivePointers: 0 };
  let captured = 0;
  let deduped = 0;
  let failed = 0;
  let waybackAttempted = 0;
  let waybackAnchored = 0;
  let waybackFailed = 0;
  let waybackPending = 0;
  const failedUrls: string[] = [];
  let lookupAttempted = 0;
  let lookupFound = 0;
  let lookupMissed = 0;
  let lookupRecovered = 0;
  const waybackAnchor = waybackRequested ? captureDeps.waybackAnchor : undefined;
  const waybackLookup = captureDeps.waybackLookup;

  for (const ref of target) {
    perSurface[ref.surface].attempted += 1;
    const outcome = await captureCitedUrl(ref, captureDeps);
    let capture = outcome.capture;
    let retrievalEvent = outcome.retrievalEvent;

    // Two moments deserve a lookup, and only these two. A local failure, where an existing
    // snapshot is the only pointer we will get. And the moment before attempting a current
    // revision SPN2 anchor, where an existing snapshot is useful historical context.
    // A successful local capture with --wayback off needs neither, so it costs no request.
    const lookupWarranted = outcome.status === 'failure' || waybackAnchor !== undefined;
    let existing: WaybackLookupResult | undefined;
    if (waybackLookup !== undefined && lookupWarranted) {
      lookupAttempted += 1;
      existing = await waybackLookup.findSnapshot(ref.url);
      if (existing.status === 'found') {
        lookupFound += 1;
        if (outcome.status === 'failure') lookupRecovered += 1;
      } else {
        lookupMissed += 1;
      }
      // The pointer, or the miss with its reason, goes on both jsonb bags this capture writes.
      // The retrieval event is the audit trail for what the lane did with this URL; the capture
      // row is where anyone reading the evidence later looks, and "we checked and found
      // nothing" is worth as much there as the pointer itself.
      retrievalEvent = {
        ...retrievalEvent,
        detail: attachWaybackLookup(retrievalEvent.detail, existing),
      };
      if (capture) {
        capture = {
          ...capture,
          storageObject: attachWaybackLookup(capture.storageObject, existing),
        };
      }
    }

    if (waybackAnchor && capture) {
      // An availability hit is a historical pointer. It does not prove that the bytes we
      // fetched for this revision were saved, so every successful local capture still submits
      // (or resumes) its URL + content hash through the durable SPN2 job store.
      waybackAttempted += 1;
      const attempt = await waybackAnchor.captureUrl(ref.url, capture.contentHashDigest);
      if (attempt.status === 'anchored') {
        waybackAnchored += 1;
      } else if (attempt.status === 'pending') {
        waybackPending += 1;
      } else {
        waybackFailed += 1;
      }
      capture = {
        ...capture,
        storageObject: attachWaybackMetadata(capture.storageObject, attempt),
      };
    }
    if (capture?.storageObject.stored === 'metadata-only') representationCounts.metadataOnly += 1;
    if (capture?.storageObject.stored === 'supabase-storage')
      representationCounts.extractedText += 1;
    if (typeof capture?.storageObject.waybackCaptureUrl === 'string')
      representationCounts.archivePointers += 1;
    const { deduped: wasDup } = await persistCapture(db, capture, retrievalEvent);
    if (outcome.status === 'failure') {
      failed += 1;
      failedUrls.push(ref.url);
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
    inventoryFingerprint,
    ...(afterUrl !== undefined ? { afterUrl } : {}),
    ...(targetUrl !== undefined ? { targetUrl } : {}),
    planned,
    remaining,
    hasMore,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
    failedUrls,
    attempted,
    captured,
    deduped,
    failed,
    captureRate: attempted > 0 ? Number(((captured + deduped) / attempted).toFixed(3)) : null,
    perSurface,
    representationCounts,
    wayback: resolveWaybackReport({
      requested: waybackRequested,
      credentialsPresent,
      commit: true,
      attempted: waybackAttempted,
      anchored: waybackAnchored,
      failed: waybackFailed,
      pending: waybackPending,
    }),
    waybackLookup: {
      available: lookupAvailable,
      attempted: lookupAttempted,
      found: lookupFound,
      missed: lookupMissed,
      recoveredAfterFetchFailure: lookupRecovered,
    },
    ...(batch.entityCount !== undefined ? { plannedEntities: batch.entityCount } : {}),
  };
}
