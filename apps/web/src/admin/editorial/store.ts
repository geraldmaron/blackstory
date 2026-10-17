/** One audited persistence boundary for story drafts, credits and exact-revision reviews. */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  storyDraftSchema,
  editorialContributorMutationSchema,
  publicStoryProjectionSchema,
  type StoryDraft,
  type EditorialStory,
  type EditorialContributor,
} from '@repo/schemas';
import { assertStaffPermission } from '../auth/staff-permissions';
import type { ServerAdminIdentity } from '../auth/supabase-server';
import type { AdminPermission } from '../auth/server-authorization';
import { queryPostgres } from '../lib/canonical-postgres-client';
import { commitWithAuditPostgres } from '../lib/postgres-commit';
import {
  UPSERT_SQL,
  upsertParams,
  rowToProjectionAuthoring,
  REFERENCE_COLUMNS,
  validateStoryOffline,
  verifyStoryReferences,
  gateDoiCitations,
  gateReferenceUrls,
  type StoryRow,
} from '../../../../../packages/ops-data/scripts/lib/story-lifecycle';

export class EditorialConflict extends Error {}
export type Actor = ServerAdminIdentity;
export async function editorialWrite<T>(
  actor: Actor,
  permission: AdminPermission,
  subjectId: string,
  action: string,
  reason: string,
  apply: (db: pg.PoolClient) => Promise<T>,
): Promise<T> {
  assertStaffPermission(actor.role, permission);
  if (!reason.trim()) throw new Error('A reason for this change is required.');
  const id = randomUUID(),
    now = new Date().toISOString();
  const subjectType = action.startsWith('entity.')
    ? 'entity'
    : action.startsWith('contributor.')
      ? 'contributor'
      : 'story';
  let value!: T;
  await commitWithAuditPostgres({
    auditEvent: {
      id,
      action: 'correction.applied',
      category: 'correction',
      actor: { type: 'user', id: actor.uid },
      subject: { type: subjectType, id: subjectId, path: `editorial/${subjectType}/${subjectId}` },
      reason,
      requestId: id,
      correlationId: id,
      idempotencyKey: `editorial:${id}`,
      occurredAt: now,
      data: { verb: action, actorRole: actor.role },
    },
    outboxMessage: {
      id: randomUUID(),
      eventId: id,
      topic: 'editorial.changed',
      aggregateType: subjectType,
      aggregateId: subjectId,
      payload: { action },
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      availableAt: now,
      createdAt: now,
      correlationId: id,
      idempotencyKey: `editorial:${id}`,
    },
    async applyState(db) {
      await db.query(
        "SELECT set_config('app.editorial_actor',$1,true),set_config('app.editorial_reason',$2,true)",
        [actor.uid, reason],
      );
      value = await apply(db);
    },
  });
  return value;
}
export async function listContributors(): Promise<EditorialContributor[]> {
  return [
    ...(await queryPostgres<EditorialContributor>(
      'SELECT id,name,kind,biography FROM reference.contributors ORDER BY name',
    )),
  ];
}
export async function saveContributor(
  actor: Actor,
  input: EditorialContributor & { linkToMe?: boolean },
  reason: string,
) {
  const parsed = editorialContributorMutationSchema.parse(input);
  return editorialWrite(
    actor,
    'roles:change',
    parsed.id,
    'contributor.save',
    reason,
    async (db) => {
      await db.query(
        `INSERT INTO reference.contributors(id,name,kind,biography) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,biography=EXCLUDED.biography,updated_at=now()`,
        [parsed.id, parsed.name, parsed.kind, parsed.biography],
      );
      if (parsed.linkToMe) {
        if (parsed.kind !== 'person') throw new Error('Only a person can link a staff account.');
        await db.query(
          `INSERT INTO access_control.contributor_accounts(contributor_id,user_id) VALUES($1,$2)
        ON CONFLICT(contributor_id) DO UPDATE SET user_id=EXCLUDED.user_id`,
          [parsed.id, actor.uid],
        );
      }
      return parsed.id;
    },
  );
}
export async function listStories() {
  return queryPostgres<{
    id: string;
    slug: string;
    title: string;
    status: string;
    revision: number;
    row_updated_at: string;
  }>(
    `SELECT id,slug,title,CASE WHEN archived_at IS NOT NULL THEN 'archived' ELSE status END AS status,revision::int,row_updated_at FROM reference.stories ORDER BY row_updated_at DESC`,
  );
}
export async function readStory(slug: string): Promise<EditorialStory | null> {
  const rows = await queryPostgres<StoryRow & { revision: string; archived_at: string | null }>(
    `SELECT ${REFERENCE_COLUMNS},revision,archived_at::text FROM reference.stories WHERE slug=$1 OR id=$1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;
  // Four independent reads: one round trip of latency instead of four in series.
  const [reviews, history, publication, publicRows] = await Promise.all([
    queryPostgres<{ decision: string; reason: string; reviewerId: string }>(
      `SELECT decision,reason,reviewer_id::text AS "reviewerId"
      FROM reference.story_reviews WHERE story_id=$1 AND revision=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,
      [row.id, row.revision],
    ),
    queryPostgres<{ revision: number; actorId: string; reason: string; createdAt: string }>(
      `SELECT revision::int,actor_id AS "actorId",reason,created_at::text AS "createdAt"
      FROM reference.story_revisions WHERE story_id=$1 ORDER BY revision DESC LIMIT 100`,
      [row.id],
    ),
    queryPostgres<{
      releaseId: string;
      previousReleaseId: string;
      revision: number;
      canRollback: boolean;
    }>(
      `SELECT p.release_id AS "releaseId",p.previous_release_id AS "previousReleaseId",p.revision::int,
    EXISTS(SELECT 1 FROM published.active_release a WHERE a.id='active' AND a.release_id=p.release_id) AS "canRollback"
    FROM reference.story_publications p WHERE story_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [row.id],
    ),
    queryPostgres<{ release_id: string }>(
      "SELECT a.release_id FROM published.release_stories a JOIN published.active_release p ON p.release_id=a.release_id AND p.id='active' WHERE a.story_id=$1",
      [row.id],
    ),
  ]);
  const draft = storyDraftSchema.parse(rowToProjectionAuthoring(row));
  return {
    archivedAt: row.archived_at,
    activePublicReleaseId: publicRows[0]?.release_id ?? null,
    publication: publication[0] ?? null,
    blockers: await storyBlockers(draft),
    draft,
    revision: Number(row.revision),
    status: row.archived_at ? 'archived' : (row.status as EditorialStory['status']),
    review: reviews[0] ?? null,
    history: [...history],
  };
}
export async function saveStory(
  actor: Actor,
  raw: unknown,
  expectedRevision: number,
  reason: string,
) {
  const draft = storyDraftSchema.parse(raw);
  if (draft.slug === 'new')
    throw new Error('Choose a different URL slug. "new" is reserved for creating stories.');
  return editorialWrite(actor, 'research:write', draft.id, 'story.save', reason, async (db) => {
    // Also serialize the first insert, before there is a row to lock.
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `editorial-story:${draft.id}`,
    ]);
    // The row lock makes the revision comparison and write one operation.
    const held = await db.query<{ revision: string; archived_at: string | null }>(
      'SELECT revision,archived_at FROM reference.stories WHERE id=$1 FOR UPDATE',
      [draft.id],
    );
    if (Number(held.rows[0]?.revision ?? 0) !== expectedRevision)
      throw new EditorialConflict(
        'A newer revision was saved. Your edits are preserved; compare the latest version before saving.',
      );
    if (held.rows[0]?.archived_at) throw new Error('Restore this archived story before editing.');
    const contributors = await db.query<EditorialContributor>(
      'SELECT id,name,kind,biography FROM reference.contributors WHERE id=ANY($1::text[])',
      [draft.contributors.map((c) => c.id)],
    );
    if (new Set(draft.contributors.map((c) => c.id)).size !== draft.contributors.length)
      throw new Error('Select each contributor only once.');
    draft.contributors = draft.contributors.map((credit) => {
      const profile = contributors.rows.find((c) => c.id === credit.id);
      if (!profile) throw new Error('A selected contributor no longer exists.');
      return {
        id: profile.id,
        name: profile.name,
        kind: profile.kind,
        roles: [...new Set(credit.roles)],
      };
    });
    const entityIds = [
      ...new Set(
        draft.relatedEntityIds.concat(
          draft.body.flatMap((b) =>
            b.type === 'mapInset' && b.entityId.trim() ? [b.entityId] : [],
          ),
        ),
      ),
    ];
    const entities = await db.query<{ id: string }>(
      `SELECT id FROM canonical.entities WHERE id=ANY($1::text[]) AND COALESCE(merge_state->>'status','')<>'absorbed'`,
      [entityIds],
    );
    if (entities.rows.length !== entityIds.length)
      throw new Error('A linked record is missing or merged. Choose its surviving record.');
    if (draft.collection) {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `editorial-collection:${draft.collection.id}`,
      ]);
      const conflict = await db.query(
        "SELECT id FROM reference.stories WHERE collection->>'id'=$1 AND (collection->>'position')::numeric=$2 AND id<>$3",
        [draft.collection.id, draft.collection.position, draft.id],
      );
      if (conflict.rows.length)
        throw new Error('Another story already occupies this collection position.');
    }
    await db.query(UPSERT_SQL, [...upsertParams({ ...draft, status: 'draft' })]);
    const saved = await db.query<{ revision: string }>(
      'SELECT revision FROM reference.stories WHERE id=$1',
      [draft.id],
    );
    return { id: draft.id, slug: draft.slug, revision: Number(saved.rows[0]!.revision) };
  });
}
export async function storyBlockers(draft: StoryDraft, db?: pg.PoolClient): Promise<string[]> {
  const issues: string[] = [];
  const parsed = publicStoryProjectionSchema.safeParse({ ...draft, releaseId: 'preview' });
  if (!parsed.success)
    issues.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  if (!draft.contributors.some((c) => c.kind === 'person' && c.roles.includes('author')))
    issues.push('Select a human author responsible for the story.');
  if (new Set(draft.references.map((ref) => ref.id)).size !== draft.references.length)
    issues.push('Each reference needs a unique citation ID.');
  if (!draft.references.length) issues.push('Attach the sources supporting the story.');
  if (parsed.success) {
    try {
      validateStoryOffline({ ...draft, status: 'published' });
    } catch (e) {
      issues.push(e instanceof Error ? e.message : 'Story validation failed.');
    }
    if (db) {
      try {
        await verifyStoryReferences(db, { ...draft, status: 'published' });
        await gateDoiCitations({ ...draft, status: 'published' });
        await gateReferenceUrls({ ...draft, status: 'published' });
      } catch (e) {
        issues.push(e instanceof Error ? e.message : 'Source validation failed.');
      }
    }
  }
  return issues;
}
export async function reviewStory(
  actor: Actor,
  id: string,
  revision: number,
  decision: string,
  reason: string,
  checks: Record<string, boolean>,
) {
  if (!['approved', 'needs_evidence', 'rejected'].includes(decision))
    throw new Error('Choose a review decision.');
  return editorialWrite(actor, 'publication:publish', id, 'story.review', reason, async (db) => {
    const rows = await db.query<StoryRow & { revision: string; archived_at: string | null }>(
      `SELECT ${REFERENCE_COLUMNS},revision,archived_at FROM reference.stories WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const row = rows.rows[0];
    if (!row || Number(row.revision) !== revision)
      throw new EditorialConflict('The draft changed. Review its current revision.');
    if (row.archived_at)
      throw new Error('Restore this archived story before review or publication.');
    if (decision === 'approved') {
      if (checks.facts !== true || checks.rights !== true || checks.prose !== true)
        throw new Error('Confirm evidence, rights and final prose review.');
      const blockers = await storyBlockers(
        storyDraftSchema.parse(rowToProjectionAuthoring(row)),
        db,
      );
      if (blockers.length) throw new Error(blockers.join('\n'));
    }
    await db.query(
      'INSERT INTO reference.story_reviews(story_id,revision,reviewer_id,decision,reason) VALUES($1,$2,$3,$4,$5)',
      [id, revision, actor.uid, decision, reason],
    );
    await db.query("UPDATE reference.stories SET status='review' WHERE id=$1", [id]);
    return { revision, decision };
  });
}
export async function restoreStory(
  actor: Actor,
  id: string,
  revision: number,
  expectedRevision: number,
  reason: string,
) {
  const rows = await queryPostgres<{ snapshot: StoryRow }>(
    'SELECT snapshot FROM reference.story_revisions WHERE story_id=$1 AND revision=$2',
    [id, revision],
  );
  if (!rows[0]) throw new Error('Revision not found.');
  return saveStory(actor, rowToProjectionAuthoring(rows[0].snapshot), expectedRevision, reason);
}
