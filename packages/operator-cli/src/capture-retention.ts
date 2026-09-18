/** Explicit retention enforcement for captured text, derived passages, and private storage. */
import type { ExecutionPool } from './research-execution.js';
import type { SupabaseStorageConfig } from './supabase-storage.js';

export type RetentionSweepInput = {
  commit: boolean;
  actor: string;
  /** Explicitly withdraw all retained text for this source item, regardless of expiry. */
  sourceItemId?: string;
  limit?: number;
};

/** Erases database text transactionally; storage disposal remains durable until acknowledged. */
export async function sweepCaptureRetention(pool: ExecutionPool, input: RetentionSweepInput) {
  const limit = input.limit ?? 100;
  if (!input.actor.trim() || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('Retention sweep requires an actor and a limit between 1 and 1000');
  if (input.sourceItemId !== undefined && !input.sourceItemId.trim())
    throw new Error('Withdrawal requires a source item id');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout='30s'");
    // Serialize metadata changes while identifying storage references shared by capture origins.
    if (input.commit)
      await db.query('LOCK TABLE evidence.capture_origins IN SHARE ROW EXCLUSIVE MODE');
    const rows = (
      await db.query(
        `SELECT * FROM evidence.capture_origins
      WHERE ($1::text IS NOT NULL AND source_item_id=$1) OR
        ($1::text IS NULL AND retention_revoked_at IS NULL AND (
          storage_object->'preservationDecision' IS NULL OR
          storage_object->'preservationDecision'='null'::jsonb OR
          coalesce(storage_object->'preservationDecision'->>'allowTextRetention','false') <> 'true' OR
          (storage_object->'preservationDecision'->>'expiresAt')::timestamptz <= clock_timestamp()))
      ORDER BY observed_at,capture_id,source_item_id LIMIT $2`,
        [input.sourceItemId ?? null, limit],
      )
    ).rows;
    let deletedPassages = 0;
    let disposedResearchPayloads = 0;
    if (input.commit)
      for (const origin of rows) {
        const object = origin.storage_object as Record<string, unknown>;
        const reason = input.sourceItemId
          ? 'explicit-withdrawal'
          : 'retention-expired-or-unapproved';
        if (
          object.stored === 'supabase-storage' &&
          typeof object.bucket === 'string' &&
          typeof object.path === 'string'
        ) {
          await db.query(
            `INSERT INTO evidence.capture_disposals(capture_id,source_item_id,bucket,object_path,reason,requested_by)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [
              origin.capture_id,
              origin.source_item_id,
              object.bucket,
              object.path,
              reason,
              input.actor,
            ],
          );
        }
        const erased = await db.query(
          'DELETE FROM evidence.retrieval_passages WHERE capture_id=$1 AND source_item_id=$2 RETURNING id',
          [origin.capture_id, origin.source_item_id],
        );
        deletedPassages += erased.rows.length;
        const metadata = {
          stored: 'metadata-only',
          sourceUrl: origin.source_url,
          representation: 'withdrawn-text',
          withdrawnBy: input.actor,
          reason,
          // Hashes and archival pointers describe custody without retaining extracted content.
          sha256: object.sha256,
          extractedTextHash: object.extractedTextHash,
          waybackCaptureUrl: object.waybackCaptureUrl,
        };
        await db.query(
          `UPDATE evidence.capture_origins SET retention_revoked_at=clock_timestamp(),storage_object=$3::jsonb
        WHERE capture_id=$1 AND source_item_id=$2`,
          [origin.capture_id, origin.source_item_id, JSON.stringify(metadata)],
        );
        // The deduplicated capture row is not a second store of retained text or policy.
        await db.query(
          `UPDATE evidence.source_captures SET storage_object=jsonb_build_object(
        'stored','metadata-only','sha256',content_hash_digest,'representation','origin-managed') WHERE id=$1`,
          [origin.capture_id],
        );
      }
    const sourceUrls = rows.map((row) => String(row.source_url));
    const payloads = await db.query(
      `SELECT id,run_id,activity_id FROM research.artifacts
       WHERE payload_disposed_at IS NULL AND (retention_until<=clock_timestamp() OR retention_source_urls && $1::text[])
       ORDER BY retention_until NULLS FIRST,id LIMIT $2`,
      [sourceUrls, limit],
    );
    const expiredRuns = await db.query(
      `SELECT id FROM research.runs WHERE execution_plan IS NOT NULL
      AND (payload_retention_until<=clock_timestamp() OR retention_source_urls && $1::text[])
      ORDER BY payload_retention_until,id LIMIT $2`,
      [sourceUrls, limit],
    );
    if (input.commit && (payloads.rows.length || expiredRuns.rows.length)) {
      const runIds = [
        ...new Set([
          ...payloads.rows.map((row) => String(row.run_id)),
          ...expiredRuns.rows.map((row) => String(row.id)),
        ]),
      ];
      await db.query(
        'SELECT id FROM research.runs WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
        [runIds],
      );
      // Erase the entire affected run's private payloads, so an unswept descendant cannot retain quotes.
      const erased = await db.query(
        `UPDATE research.artifacts SET extensions=jsonb_build_object('disposition','retention-withdrawal','disposedBy',$2::text),payload_disposed_at=clock_timestamp()
         WHERE run_id=ANY($1::text[]) AND payload_disposed_at IS NULL RETURNING id`,
        [runIds, input.actor],
      );
      disposedResearchPayloads = erased.rows.length;
      await db.query(
        `UPDATE research.model_invocations SET raw_response='[payload disposed]'
        WHERE activity_id IN (SELECT id FROM research.agent_activities WHERE run_id=ANY($1::text[]))`,
        [runIds],
      );
      await db.query(
        `UPDATE research.model_output_quarantine SET raw_output='[payload disposed]',validation_errors=ARRAY['payload disposed']
        WHERE invocation_id IN (SELECT invocation.id FROM research.model_invocations invocation JOIN research.agent_activities activity ON activity.id=invocation.activity_id WHERE activity.run_id=ANY($1::text[]))`,
        [runIds],
      );
      await db.query(
        `UPDATE research.runs SET execution_plan=NULL,
        status=CASE WHEN status IN ('pending','running') THEN 'escalated' ELSE status END,
        completed_at=coalesce(completed_at,clock_timestamp()),terminal_reason='source_payload_retention_withdrawn'
        WHERE id=ANY($1::text[])`,
        [runIds],
      );
      await db.query(
        `UPDATE research.frontier_tasks SET input='{}'::jsonb,
        status=CASE WHEN status IN ('pending','leased','failed') THEN 'cancelled' ELSE status END
        WHERE run_id=ANY($1::text[])`,
        [runIds],
      );
    }
    if (input.commit)
      await db.query(`UPDATE research.model_output_quarantine SET raw_output='[payload disposed]',validation_errors=ARRAY['payload disposed']
      WHERE retention_until<=clock_timestamp() AND raw_output<>'[payload disposed]'`);
    const pending = await db.query(
      `SELECT (SELECT count(*) FROM evidence.capture_disposals WHERE deleted_at IS NULL)+
        (SELECT count(*) FROM evidence.capture_orphan_disposals WHERE deleted_at IS NULL) AS count`,
    );
    await db.query(input.commit ? 'COMMIT' : 'ROLLBACK');
    return {
      committed: input.commit,
      selectedOrigins: rows.length,
      deletedPassages,
      disposedResearchPayloads,
      selectedResearchPayloads: payloads.rows.length,
      selectedRunManifests: expiredRuns.rows.length,
      pendingStorageDisposals: Number(pending.rows[0]?.count ?? 0),
      sources: rows.map((row) => ({
        captureId: row.capture_id,
        sourceItemId: row.source_item_id,
        sourceUrl: row.source_url,
      })),
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

/** A failed DELETE leaves its queue entry pending. Repeating a confirmed deletion is harmless. */
export async function drainCaptureDisposals(
  pool: ExecutionPool,
  config: SupabaseStorageConfig,
  limit = 100,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('Disposal limit must be 1–1000');
  const db = await pool.connect();
  let deleted = 0;
  let shared = 0;
  try {
    const rows = (
      await db.query(
        `SELECT DISTINCT ON (bucket,object_path) bucket,object_path,requested_at FROM (
          SELECT bucket,object_path,requested_at FROM evidence.capture_disposals WHERE deleted_at IS NULL
          UNION ALL SELECT bucket,object_path,requested_at FROM evidence.capture_orphan_disposals WHERE deleted_at IS NULL
        ) pending
      ORDER BY bucket,object_path,requested_at LIMIT $1`,
        [limit],
      )
    ).rows;
    for (const row of rows) {
      if (
        row.bucket !== config.bucket ||
        typeof row.object_path !== 'string' ||
        !/^captures\/[a-z0-9/.-]+\.txt$/.test(row.object_path)
      )
        throw new Error('Disposal object is outside the configured capture storage boundary');
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL statement_timeout='30s'");
        // Prevent a new origin reference from racing the external deletion.
        await db.query('LOCK TABLE evidence.capture_origins IN SHARE ROW EXCLUSIVE MODE');
        const references = await db.query(
          `SELECT 1 FROM evidence.capture_origins
        WHERE storage_object->>'bucket'=$1 AND storage_object->>'path'=$2 LIMIT 1`,
          [row.bucket, row.object_path],
        );
        if (references.rows.length) {
          shared++;
          await db.query('COMMIT');
          continue;
        }
        const response = await (config.transport ?? fetch)(
          `${config.url.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(config.bucket)}`,
          {
            method: 'DELETE',
            headers: {
              authorization: `Bearer ${config.secretKey}`,
              apikey: config.secretKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ prefixes: [row.object_path] }),
            signal: AbortSignal.timeout(30_000),
          },
        );
        if (!response.ok)
          throw new Error(`Capture disposal failed (${response.status}); retained for retry`);
        await db.query(
          `UPDATE evidence.capture_disposals SET deleted_at=clock_timestamp()
        WHERE bucket=$1 AND object_path=$2 AND deleted_at IS NULL`,
          [row.bucket, row.object_path],
        );
        await db.query(
          `UPDATE evidence.capture_orphan_disposals SET deleted_at=clock_timestamp()
          WHERE bucket=$1 AND object_path=$2 AND deleted_at IS NULL`,
          [row.bucket, row.object_path],
        );
        await db.query('COMMIT');
        deleted++;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }
    return { deletedObjects: deleted, sharedObjectsDeferred: shared };
  } finally {
    db.release();
  }
}

/** Inventory Storage metadata only. Object deletion uses the Storage API through the disposal queue. */
export async function reconcileOrphanCaptures(
  pool: ExecutionPool,
  input: { bucket: string; actor: string; commit: boolean; limit: number },
) {
  if (
    !input.bucket.trim() ||
    !input.actor.trim() ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 1000
  )
    throw new Error('Orphan reconciliation requires a bucket, actor and limit between 1 and 1000');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout='30s'");
    if (input.commit)
      await db.query('LOCK TABLE evidence.capture_origins IN SHARE ROW EXCLUSIVE MODE');
    const rows = (
      await db.query(
        `SELECT object.name FROM storage.objects object
      WHERE object.bucket_id=$1 AND object.name ~ '^captures/([a-f0-9]{64}/)?[a-f0-9]{64}\\.txt$'
        AND object.created_at < clock_timestamp()-interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM evidence.capture_origins origin
          WHERE origin.storage_object->>'bucket'=$1 AND origin.storage_object->>'path'=object.name)
      ORDER BY object.name LIMIT $2`,
        [input.bucket, input.limit],
      )
    ).rows;
    if (input.commit)
      for (const row of rows)
        await db.query(
          `INSERT INTO evidence.capture_orphan_disposals(bucket,object_path,requested_by)
      VALUES($1,$2,$3) ON CONFLICT(bucket,object_path) DO UPDATE SET deleted_at=NULL,requested_by=EXCLUDED.requested_by`,
          [input.bucket, row.name, input.actor],
        );
    await db.query(input.commit ? 'COMMIT' : 'ROLLBACK');
    return {
      committed: input.commit,
      orphanObjects: rows.map((row) => ({ bucket: input.bucket, path: row.name })),
      graceHours: 24,
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
