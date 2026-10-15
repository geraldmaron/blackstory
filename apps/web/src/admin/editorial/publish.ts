/** Exact reviewed article revisions use the same signed release executor as catalog work. */
import { randomUUID } from 'node:crypto';
import { articleDraftSchema, publicArticleProjectionSchema } from '@repo/schemas';
import { copyRelease, finalizeEditorialRelease } from '../work/publish-work';
import { getPostgresPool } from '../lib/canonical-postgres-client';
import { articleBlockers, editorialWrite, EditorialConflict, type Actor } from './store';
import { editorialStorage } from './media';
import {
  REFERENCE_COLUMNS,
  rowToProjectionAuthoring,
  contentHash,
  type ArticleRow,
} from '../../../../../packages/ops-data/scripts/lib/article-lifecycle';
import type { ArticleImageDoc } from '@repo/schemas';

async function releaseImage(
  image: ArticleImageDoc,
  articleId: string,
  releaseId: string,
): Promise<ArticleImageDoc> {
  const match = new URL(image.url).pathname.match(/^\/admin\/stories\/media\/([a-f0-9-]+)$/);
  if (!match) return image;
  const rows = await getPostgresPool().query(
    'SELECT * FROM reference.editorial_media WHERE id=$1 AND article_id=$2',
    [match[1], articleId],
  );
  const media = rows.rows[0];
  if (!media) throw new Error('This image does not belong to the article.');
  const storage = editorialStorage(),
    download = await storage.from('editorial-media').download(media.object_path);
  if (download.error || !download.data) throw new Error('Private image is unavailable.');
  const bytes = Buffer.from(await download.data.arrayBuffer());
  const { createHash } = await import('node:crypto');
  if (createHash('sha256').update(bytes).digest('hex') !== media.content_hash)
    throw new Error('Image integrity check failed.');
  const path = `releases/${releaseId}/articles/${articleId}/${media.id}-${media.content_hash}`;
  const upload = await storage.from('public-media').upload(path, bytes, {
    contentType: media.content_type,
    upsert: false,
    cacheControl: '31536000',
  });
  if (
    upload.error &&
    String(upload.error.statusCode) !== '409' &&
    !upload.error.message.toLowerCase().includes('already exists')
  )
    throw new Error('Release image upload failed.');
  const url = storage.from('public-media').getPublicUrl(path).data.publicUrl;
  const check = await fetch(url);
  if (
    !check.ok ||
    createHash('sha256')
      .update(Buffer.from(await check.arrayBuffer()))
      .digest('hex') !== media.content_hash
  )
    throw new Error('Release image readback failed.');
  return {
    ...image,
    url,
    objectPath: path,
    credit: media.credit,
    rightsStatus: media.rights_status,
  };
}
export async function publishArticle(actor: Actor, id: string, revision: number, reason: string) {
  return editorialWrite(actor, 'publication:publish', id, 'article.publish', reason, async (db) => {
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('publication-release-pointer',0))",
    );
    const selected = await db.query<ArticleRow & { revision: string; archived_at: string | null }>(
      `SELECT ${REFERENCE_COLUMNS},revision,archived_at FROM reference.articles WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const row = selected.rows[0];
    if (!row || Number(row.revision) !== revision)
      throw new EditorialConflict('The article changed. Review its current revision.');
    if (row.archived_at)
      throw new Error('Restore this archived article before review or publication.');
    const priorPublication = await db.query(
      `SELECT p.release_id,p.previous_release_id FROM reference.article_publications p
       JOIN published.active_release a ON a.release_id=p.release_id AND a.id='active'
       WHERE p.article_id=$1 AND p.revision=$2 ORDER BY p.created_at DESC LIMIT 1`,
      [id, revision],
    );
    if (priorPublication.rows[0]) {
      await db.query("UPDATE reference.articles SET status='published' WHERE id=$1", [id]);
      return {
        releaseId: priorPublication.rows[0].release_id,
        previousReleaseId: priorPublication.rows[0].previous_release_id,
        revision,
      };
    }
    const review = await db.query(
      'SELECT decision FROM reference.article_reviews WHERE article_id=$1 AND revision=$2 ORDER BY created_at DESC,id DESC LIMIT 1',
      [id, revision],
    );
    if (review.rows[0]?.decision !== 'approved')
      throw new Error('The current revision needs approval before publication.');
    const draft = articleDraftSchema.parse(rowToProjectionAuthoring(row));
    const blockers = await articleBlockers(draft, db);
    if (blockers.length) throw new Error(blockers.join('\n'));
    const active = await db.query(
      "SELECT release_id FROM published.active_release WHERE id='active' FOR UPDATE",
    );
    const previous = active.rows[0]?.release_id;
    if (!previous) throw new Error('An existing catalog release is required.');
    const releaseId = `rel_article_${randomUUID().replaceAll('-', '')}`,
      now = new Date().toISOString();
    await db.query(
      "INSERT INTO publication.releases(id,status,search_index_version,created_by,created_at) VALUES($1,'preview',$2,$3,$4)",
      [releaseId, `search_${releaseId}`, actor.uid, now],
    );
    await copyRelease(db, previous, releaseId);
    if (draft.heroImage) draft.heroImage = await releaseImage(draft.heroImage, id, releaseId);
    for (const block of draft.body)
      if (block.type === 'image') block.image = await releaseImage(block.image, id, releaseId);
    const doc = publicArticleProjectionSchema.parse({ ...draft, releaseId });
    await db.query(
      `INSERT INTO published.release_articles(release_id,article_id,slug,theme_id,published_at,payload,content_hash) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)
   ON CONFLICT(release_id,article_id) DO UPDATE SET slug=EXCLUDED.slug,theme_id=EXCLUDED.theme_id,published_at=EXCLUDED.published_at,payload=EXCLUDED.payload,content_hash=EXCLUDED.content_hash`,
      [
        releaseId,
        id,
        doc.slug,
        doc.themeId ?? null,
        doc.publishedAt,
        JSON.stringify(doc),
        contentHash(doc),
      ],
    );
    await finalizeEditorialRelease(db, getPostgresPool(), previous, releaseId, now, async () => {
      const allowed = await db.query(
        'SELECT research.management_owner_can_publish($1) AS allowed',
        [actor.uid],
      );
      if (!allowed.rows[0]?.allowed) throw new Error('Publication permission is no longer active.');
    });
    await db.query("UPDATE reference.articles SET status='published' WHERE id=$1", [id]);
    await db.query(
      'INSERT INTO reference.article_publications(article_id,revision,release_id,previous_release_id,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)',
      [id, revision, releaseId, previous, actor.uid, reason],
    );
    return { releaseId, previousReleaseId: previous, revision };
  });
}

/** Retract the latest article release without reverting unrelated catalog content. */
export async function rollbackArticle(
  actor: Actor,
  id: string,
  expectedReleaseId: string,
  reason: string,
) {
  return editorialWrite(
    actor,
    'publication:retract',
    id,
    'article.rollback',
    reason,
    async (db) => {
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('publication-release-pointer',0))",
      );
      const active = await db.query(
        "SELECT release_id FROM published.active_release WHERE id='active' FOR UPDATE",
      );
      if (active.rows[0]?.release_id !== expectedReleaseId)
        throw new EditorialConflict('The public release changed. Reload before rollback.');
      const receipts = await db.query(
        'SELECT previous_release_id FROM reference.article_publications WHERE article_id=$1 AND release_id=$2 ORDER BY created_at DESC LIMIT 1',
        [id, expectedReleaseId],
      );
      const previous = receipts.rows[0]?.previous_release_id;
      if (!previous) throw new Error('There is no article publication receipt for this release.');
      const old = await db.query(
        'SELECT payload FROM published.release_articles WHERE release_id=$1 AND article_id=$2',
        [previous, id],
      );
      if (old.rows.length) {
        const { verifySignedReleaseManifest, sha256Json } = await import('@repo/domain');
        const { createPublicKey, createHash } = await import('node:crypto');
        const signedRow = await db.query(
          'SELECT signed_manifest FROM publication.releases WHERE id=$1',
          [previous],
        );
        const signed = signedRow.rows[0]?.signed_manifest,
          pem = process.env.RELEASE_SIGNING_PUBLIC_KEY;
        if (
          !pem ||
          createHash('sha256').update(pem).digest('hex') !==
            process.env.EXPECTED_RELEASE_SIGNING_PUBLIC_KEY_SHA256 ||
          !signed?.manifest ||
          !verifySignedReleaseManifest(
            { ...signed, manifestHash: { algorithm: 'sha256', digest: signed.manifestHash } },
            createPublicKey(pem),
          )
        )
          throw new Error('The previous article release signature could not be verified.');
        const articleArtifact = signed.manifest.aggregateArtifacts?.find((a: { path: string }) =>
          a.path.endsWith('/articles.json'),
        );
        if (!articleArtifact)
          throw new Error(
            'The previous release does not contain signed article artifacts. Restore its revision and review it instead.',
          );
        const response = await fetch(
          `${process.env.SUPABASE_URL}/storage/v1/object/public/public-media/${articleArtifact.path}`,
        );
        if (!response.ok) throw new Error('The prior article artifact is unavailable.');
        const artifact = await response.json();
        if (
          sha256Json(artifact).digest !== articleArtifact.hash.digest ||
          !artifact.articles.some(
            (doc: unknown) => contentHash(doc) === contentHash(old.rows[0].payload),
          )
        )
          throw new Error('The previous article does not match its signed artifact.');
      }
      const releaseId = `rel_rollback_${randomUUID().replaceAll('-', '')}`,
        now = new Date().toISOString();
      await db.query(
        "INSERT INTO publication.releases(id,status,search_index_version,created_by,created_at) VALUES($1,'preview',$2,$3,$4)",
        [releaseId, `search_${releaseId}`, actor.uid, now],
      );
      await copyRelease(db, expectedReleaseId, releaseId);
      await db.query(
        'DELETE FROM published.release_articles WHERE release_id=$1 AND article_id=$2',
        [releaseId, id],
      );
      if (old.rows[0]) {
        const doc = publicArticleProjectionSchema.parse({ ...old.rows[0].payload, releaseId });
        await db.query(
          'INSERT INTO published.release_articles(release_id,article_id,slug,theme_id,published_at,payload,content_hash) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',
          [
            releaseId,
            id,
            doc.slug,
            doc.themeId ?? null,
            doc.publishedAt,
            JSON.stringify(doc),
            contentHash(doc),
          ],
        );
      }
      await finalizeEditorialRelease(
        db,
        getPostgresPool(),
        expectedReleaseId,
        releaseId,
        now,
        async () => {
          const allowed = await db.query(
            'SELECT research.management_owner_can_publish($1) AS allowed',
            [actor.uid],
          );
          if (!allowed.rows[0]?.allowed) throw new Error('Publication authority was revoked.');
        },
      );
      await db.query("UPDATE reference.articles SET status='draft' WHERE id=$1", [id]);
      return { releaseId, restoredFromReleaseId: previous };
    },
  );
}
