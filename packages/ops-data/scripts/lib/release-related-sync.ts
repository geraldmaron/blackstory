/**
 * Shared logic for syncing `bb_public.release_entities.related` (and `projection.related`) from
 * the canonical source of truth, `bb_canonical.entity_relationships`.
 *
 * Root cause this closes: `ReleaseSourceEntity` carries no relationship edges, so every path that
 * rebuilds a release row from source — notably `publish-release-entities-incremental --republish`
 * — writes `related: []`. The links only came back by remembering to run two more scripts in the
 * right order afterwards, and nothing warned when they were skipped: the records simply published
 * with no connections and the "How this record connects" beat disappeared. That was forgotten
 * twice in one session by someone who knew about it, which is what makes documentation the wrong
 * fix. This module is the one place the edge -> related mapping happens, callable both as a
 * one-time backfill and as a step every release-affecting operation runs afterward.
 *
 * The sync is authoritative — it replaces `related` rather than only filling an empty one. That
 * is deliberate and was measured before it was chosen: on the active release, canonical edges are
 * a strict superset of what is published (1,193 published pairs, 1,762 derivable, zero published
 * pairs with no canonical edge behind them), so replacing deletes nothing that had a source. It
 * also fixes the case an empty-only guard structurally cannot reach — a list that is stale rather
 * than empty, which is what an entity merge leaves behind (repo-n7p6.15) and how Garrett Morgan
 * kept one 'authored' edge while both of his inventions stayed missing.
 *
 * Only edges whose OTHER endpoint is also in the release are emitted; an edge to an unreleased
 * entity never renders and would dead-link.
 */
import type { Pool, PoolClient } from 'pg';

export type ReleaseRelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
};

export type ReleaseRelatedSyncRow = {
  readonly entityId: string;
  readonly before: readonly ReleaseRelatedEntry[];
  readonly after: readonly ReleaseRelatedEntry[];
};

export type ReleaseRelatedSyncReport = {
  readonly releaseId: string;
  readonly scanned: number;
  readonly changed: readonly ReleaseRelatedSyncRow[];
  readonly unchanged: number;
  /** Rows that gain edges where they previously had none — the republish-wipe victims. */
  readonly repaired: number;
};

/**
 * Both endpoints must be in `releaseId`. `direction` is relative to the row's own entity, so each
 * accepted+published edge contributes two rows: outgoing for the `from` side, incoming for `to`.
 */
const DERIVE_SQL = `
  WITH released AS (
    SELECT entity_id FROM bb_public.release_entities WHERE release_id = $1
  ),
  edges AS (
    SELECT er.from_entity_id AS eid, er.to_entity_id AS other_id,
           er.relationship_type, 'outgoing'::text AS direction
    FROM bb_canonical.entity_relationships er
    WHERE er.workflow_status = 'accepted' AND er.publication_status = 'published'
    UNION ALL
    SELECT er.to_entity_id, er.from_entity_id, er.relationship_type, 'incoming'
    FROM bb_canonical.entity_relationships er
    WHERE er.workflow_status = 'accepted' AND er.publication_status = 'published'
  )
  SELECT e.eid AS entity_id, e.other_id, e.relationship_type, e.direction
  FROM edges e
  JOIN released r ON r.entity_id = e.eid
  JOIN released r2 ON r2.entity_id = e.other_id
  -- When several edges join the same pair, only one becomes the rendered entry (see the dedup in
  -- planReleaseRelatedSync), so this ORDER BY decides which relationship word the reader sees.
  -- Plain alphabetical decided it by spelling, which lets the generic 'related_to' win any pair
  -- whose only specific type sorts later ('successor_of'). No pair in the active release is in
  -- that state today — measured 2026-09-09, 110 multi-type pairs involve related_to and
  -- alphabetical picks it for zero of them — so this clause changes nothing now and exists so a
  -- later edge type cannot quietly acquire the behavior. RELATIONSHIP_TYPE_SEMANTICS defines
  -- related_to as a "symmetric/loose association with no stronger typed fit", so it is the
  -- vocabulary's own fallback and must lose to every specific type. Sorting it last reads that
  -- definition rather than ranking the others: where two
  -- SPECIFIC types join a pair (attended vs participated_in, employed_by vs member_of) the tie is
  -- still broken alphabetically, which is deterministic but arbitrary and picks the weaker word
  -- often enough to matter. Ratifying a specificity order is repo-q16vc.
  ORDER BY e.eid, e.other_id, (e.relationship_type = 'related_to'), e.relationship_type
`;

function asRelatedEntries(value: unknown): readonly ReleaseRelatedEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: ReleaseRelatedEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const { id, type, direction } = record;
    if (typeof id !== 'string' || typeof type !== 'string') continue;
    if (direction !== 'outgoing' && direction !== 'incoming') continue;
    entries.push({ id, type, direction });
  }
  return entries;
}

/** Order-insensitive comparison; the derived list is sorted, a published one may not be. */
function sameEntries(
  a: readonly ReleaseRelatedEntry[],
  b: readonly ReleaseRelatedEntry[],
): boolean {
  if (a.length !== b.length) return false;
  const encode = (entry: ReleaseRelatedEntry) => `${entry.id}|${entry.type}|${entry.direction}`;
  const left = [...a].map(encode).sort();
  const right = [...b].map(encode).sort();
  return left.every((value, index) => value === right[index]);
}

/**
 * Computes the corrected `related` for every entity in `releaseId`, without writing anything.
 * Use this to preview a sync (dry-run) or as the basis for an apply pass.
 */
export async function planReleaseRelatedSync(
  client: Pool | PoolClient,
  releaseId: string,
): Promise<ReleaseRelatedSyncReport> {
  const derived = await client.query<{
    entity_id: string;
    other_id: string;
    relationship_type: string;
    direction: 'outgoing' | 'incoming';
  }>(DERIVE_SQL, [releaseId]);

  const byEntity = new Map<string, ReleaseRelatedEntry[]>();
  for (const row of derived.rows) {
    let entries = byEntity.get(row.entity_id);
    if (!entries) {
      entries = [];
      byEntity.set(row.entity_id, entries);
    }
    // Dedup: one entry per neighbor, first (alphabetically stable) edge wins. Matches what
    // backfill-release-related-from-edges has always emitted; widening it to multi-edge is a
    // separate decision about how the connects beat should read, not a side effect of this sync.
    if (!entries.some((entry) => entry.id === row.other_id)) {
      entries.push({
        id: row.other_id,
        type: row.relationship_type,
        direction: row.direction,
      });
    }
  }

  const published = await client.query<{ entity_id: string; related: unknown }>(
    `SELECT entity_id, related FROM bb_public.release_entities WHERE release_id = $1
     ORDER BY entity_id`,
    [releaseId],
  );

  const changed: ReleaseRelatedSyncRow[] = [];
  let unchanged = 0;
  let repaired = 0;

  for (const row of published.rows) {
    const before = asRelatedEntries(row.related);
    const after = byEntity.get(row.entity_id) ?? [];
    if (sameEntries(before, after)) {
      unchanged += 1;
      continue;
    }
    if (before.length === 0 && after.length > 0) repaired += 1;
    changed.push({ entityId: row.entity_id, before, after });
  }

  return { releaseId, scanned: published.rows.length, changed, unchanged, repaired };
}

/**
 * Applies a previously computed plan, writing BOTH the top-level `related` jsonb and
 * `projection.related`. The read side and the graph rebuild disagree about which one they use, so
 * writing only one of them leaves the pair inconsistent (hydrate-via-event-neighbors precedent).
 */
export async function applyReleaseRelatedSync(
  client: Pool | PoolClient,
  releaseId: string,
  plan: ReleaseRelatedSyncReport,
): Promise<void> {
  for (const row of plan.changed) {
    const related = JSON.stringify(row.after);
    await client.query(
      `UPDATE bb_public.release_entities
         SET related = $1::jsonb,
             projection = COALESCE(projection, '{}'::jsonb) || jsonb_build_object('related', $1::jsonb)
       WHERE release_id = $2 AND entity_id = $3`,
      [related, releaseId, row.entityId],
    );
  }
}
