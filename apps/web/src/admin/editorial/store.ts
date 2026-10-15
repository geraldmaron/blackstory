/** One audited persistence boundary for article drafts, credits and exact-revision reviews. */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  articleDraftSchema,
  editorialContributorMutationSchema,
  publicArticleProjectionSchema,
  type ArticleDraft,
  type EditorialArticle,
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
  validateArticleOffline,
  verifyArticleReferences,
  gateDoiCitations,
  gateReferenceUrls,
  type ArticleRow,
} from '../../../../../packages/ops-data/scripts/lib/article-lifecycle';

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
      : 'article';
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
export async function listArticles() {
  return queryPostgres<{
    id: string;
    slug: string;
    title: string;
    status: string;
    revision: number;
    row_updated_at: string;
  }>(
    `SELECT id,slug,title,CASE WHEN archived_at IS NOT NULL THEN 'archived' ELSE status END AS status,revision::int,row_updated_at FROM reference.articles ORDER BY row_updated_at DESC`,
  );
}
export async function readArticle(slug: string): Promise<EditorialArticle | null> {
  const rows = await queryPostgres<ArticleRow & { revision: string; archived_at: string | null }>(
    `SELECT ${REFERENCE_COLUMNS},revision,archived_at::text FROM reference.articles WHERE slug=$1 OR id=$1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;
  const [reviews, history] = await Promise.all([
    queryPostgres<{ decision: string; reason: string; reviewerId: string }>(
      `SELECT decision,reason,reviewer_id::text AS "reviewerId"
      FROM reference.article_reviews WHERE article_id=$1 AND revision=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,
      [row.id, row.revision],
    ),
    queryPostgres<{ revision: number; actorId: string; reason: string; createdAt: string }>(
      `SELECT revision::int,actor_id AS "actorId",reason,created_at::text AS "createdAt"
      FROM reference.article_revisions WHERE article_id=$1 ORDER BY revision DESC LIMIT 100`,
      [row.id],
    ),
  ]);
  const publication = await queryPostgres<{
    releaseId: string;
    previousReleaseId: string;
    revision: number;
    canRollback: boolean;
  }>(
    `SELECT p.release_id AS "releaseId",p.previous_release_id AS "previousReleaseId",p.revision::int,
    EXISTS(SELECT 1 FROM published.active_release a WHERE a.id='active' AND a.release_id=p.release_id) AS "canRollback"
    FROM reference.article_publications p WHERE article_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [row.id],
  );
  const publicRows = await queryPostgres<{ release_id: string }>(
    "SELECT a.release_id FROM published.release_articles a JOIN published.active_release p ON p.release_id=a.release_id AND p.id='active' WHERE a.article_id=$1",
    [row.id],
  );
  return {
    archivedAt: row.archived_at,
    activePublicReleaseId: publicRows[0]?.release_id ?? null,
    publication: publication[0] ?? null,
    blockers: await articleBlockers(articleDraftSchema.parse(rowToProjectionAuthoring(row))),
    draft: articleDraftSchema.parse(rowToProjectionAuthoring(row)),
    revision: Number(row.revision),
    status: row.archived_at ? 'archived' : (row.status as EditorialArticle['status']),
    review: reviews[0] ?? null,
    history: [...history],
  };
}
export async function saveArticle(
  actor: Actor,
  raw: unknown,
  expectedRevision: number,
  reason: string,
) {
  const draft = articleDraftSchema.parse(raw);
  if (draft.slug === 'new')
    throw new Error('Choose a different URL slug. "new" is reserved for creating articles.');
  return editorialWrite(actor, 'research:write', draft.id, 'article.save', reason, async (db) => {
    // Also serialize the first insert, before there is a row to lock.
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `editorial-article:${draft.id}`,
    ]);
    // The row lock makes the revision comparison and write one operation.
    const held = await db.query<{ revision: string; archived_at: string | null }>(
      'SELECT revision,archived_at FROM reference.articles WHERE id=$1 FOR UPDATE',
      [draft.id],
    );
    if (Number(held.rows[0]?.revision ?? 0) !== expectedRevision)
      throw new EditorialConflict(
        'A newer revision was saved. Your edits are preserved; compare the latest version before saving.',
      );
    if (held.rows[0]?.archived_at) throw new Error('Restore this archived article before editing.');
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
    if (draft.series) {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `editorial-series:${draft.series.id}`,
      ]);
      const conflict = await db.query(
        "SELECT id FROM reference.articles WHERE series->>'id'=$1 AND (series->>'position')::numeric=$2 AND id<>$3",
        [draft.series.id, draft.series.position, draft.id],
      );
      if (conflict.rows.length)
        throw new Error('Another article already occupies this collection position.');
    }
    await db.query(UPSERT_SQL, [...upsertParams({ ...draft, status: 'draft' })]);
    const saved = await db.query<{ revision: string }>(
      'SELECT revision FROM reference.articles WHERE id=$1',
      [draft.id],
    );
    return { id: draft.id, slug: draft.slug, revision: Number(saved.rows[0]!.revision) };
  });
}
export async function articleBlockers(draft: ArticleDraft, db?: pg.PoolClient): Promise<string[]> {
  const issues: string[] = [];
  const parsed = publicArticleProjectionSchema.safeParse({ ...draft, releaseId: 'preview' });
  if (!parsed.success)
    issues.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  if (!draft.contributors.some((c) => c.kind === 'person' && c.roles.includes('author')))
    issues.push('Select a human author responsible for the article.');
  if (new Set(draft.references.map((ref) => ref.id)).size !== draft.references.length)
    issues.push('Each reference needs a unique citation ID.');
  if (!draft.references.length) issues.push('Attach the sources supporting the article.');
  if (parsed.success) {
    try {
      validateArticleOffline({ ...draft, status: 'published' });
    } catch (e) {
      issues.push(e instanceof Error ? e.message : 'Article validation failed.');
    }
    if (db) {
      try {
        await verifyArticleReferences(db, { ...draft, status: 'published' });
        await gateDoiCitations({ ...draft, status: 'published' });
        await gateReferenceUrls({ ...draft, status: 'published' });
      } catch (e) {
        issues.push(e instanceof Error ? e.message : 'Source validation failed.');
      }
    }
  }
  return issues;
}
export async function reviewArticle(
  actor: Actor,
  id: string,
  revision: number,
  decision: string,
  reason: string,
  checks: Record<string, boolean>,
) {
  if (!['approved', 'needs_evidence', 'rejected'].includes(decision))
    throw new Error('Choose a review decision.');
  return editorialWrite(actor, 'publication:publish', id, 'article.review', reason, async (db) => {
    const rows = await db.query<ArticleRow & { revision: string; archived_at: string | null }>(
      `SELECT ${REFERENCE_COLUMNS},revision,archived_at FROM reference.articles WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const row = rows.rows[0];
    if (!row || Number(row.revision) !== revision)
      throw new EditorialConflict('The draft changed. Review its current revision.');
    if (row.archived_at)
      throw new Error('Restore this archived article before review or publication.');
    if (decision === 'approved') {
      if (checks.facts !== true || checks.rights !== true || checks.prose !== true)
        throw new Error('Confirm evidence, rights and final prose review.');
      const blockers = await articleBlockers(
        articleDraftSchema.parse(rowToProjectionAuthoring(row)),
        db,
      );
      if (blockers.length) throw new Error(blockers.join('\n'));
    }
    await db.query(
      'INSERT INTO reference.article_reviews(article_id,revision,reviewer_id,decision,reason) VALUES($1,$2,$3,$4,$5)',
      [id, revision, actor.uid, decision, reason],
    );
    await db.query("UPDATE reference.articles SET status='review' WHERE id=$1", [id]);
    return { revision, decision };
  });
}
export async function restoreArticle(
  actor: Actor,
  id: string,
  revision: number,
  expectedRevision: number,
  reason: string,
) {
  const rows = await queryPostgres<{ snapshot: ArticleRow }>(
    'SELECT snapshot FROM reference.article_revisions WHERE article_id=$1 AND revision=$2',
    [id, revision],
  );
  if (!rows[0]) throw new Error('Revision not found.');
  return saveArticle(actor, rowToProjectionAuthoring(rows[0].snapshot), expectedRevision, reason);
}
