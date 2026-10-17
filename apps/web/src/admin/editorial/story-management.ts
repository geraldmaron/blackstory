/** Recoverable deletion uses the same signed release boundary as story publication. */
import { randomUUID } from 'node:crypto';
import { getPostgresPool } from '../lib/canonical-postgres-client';
import { copyRelease, finalizeEditorialRelease } from '../work/publish-work';
import { assertStaffPermission } from '../auth/staff-permissions';
import { editorialWrite, EditorialConflict, type Actor } from './store';

export async function archiveStory(
  actor: Actor,
  id: string,
  revision: number,
  expectedPublicReleaseId: string | null,
  confirmed: boolean,
  reason: string,
) {
  // An authenticated reader cannot acquire write authority by calling this endpoint.
  const permission = expectedPublicReleaseId ? 'publication:retract' : 'research:write';
  return editorialWrite(actor, permission, id, 'story.archive', reason, async (db) => {
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('publication-release-pointer',0))",
    );
    const rows = await db.query(
      'SELECT revision,archived_at FROM reference.stories WHERE id=$1 FOR UPDATE',
      [id],
    );
    const row = rows.rows[0];
    if (!row || Number(row.revision) !== revision)
      throw new EditorialConflict('The story changed. Reload before archiving.');
    if (row.archived_at) throw new Error('This story is already archived.');
    const publicRows = await db.query(
      "SELECT a.release_id FROM published.release_stories a JOIN published.active_release p ON p.release_id=a.release_id AND p.id='active' WHERE a.story_id=$1 FOR UPDATE OF p",
      [id],
    );
    const previous = publicRows.rows[0]?.release_id ?? null;
    if (previous !== expectedPublicReleaseId)
      throw new EditorialConflict('The public version changed. Reload before archiving.');
    let releaseId: string | null = null;
    if (previous) {
      assertStaffPermission(actor.role, 'publication:retract');
      if (!confirmed) throw new Error('Confirm removal of the public story before archiving.');
      releaseId = `rel_archive_${randomUUID().replaceAll('-', '')}`;
      const now = new Date().toISOString();
      await db.query(
        "INSERT INTO publication.releases(id,status,search_index_version,created_by,created_at) VALUES($1,'preview',$2,$3,$4)",
        [releaseId, `search_${releaseId}`, actor.uid, now],
      );
      await copyRelease(db, previous, releaseId);
      await db.query('DELETE FROM published.release_stories WHERE release_id=$1 AND story_id=$2', [
        releaseId,
        id,
      ]);
      await finalizeEditorialRelease(db, getPostgresPool(), previous, releaseId, now, async () => {
        const allowed = await db.query(
          'SELECT research.management_owner_can_publish($1) AS allowed',
          [actor.uid],
        );
        if (!allowed.rows[0]?.allowed) throw new Error('Publication authority was revoked.');
      });
    }
    await db.query(
      "UPDATE reference.stories SET archived_at=clock_timestamp(),status='draft' WHERE id=$1",
      [id],
    );
    return { id, releaseId, archived: true };
  });
}

export async function unarchiveStory(actor: Actor, id: string, revision: number, reason: string) {
  return editorialWrite(actor, 'research:write', id, 'story.unarchive', reason, async (db) => {
    const rows = await db.query(
      'SELECT revision,archived_at FROM reference.stories WHERE id=$1 FOR UPDATE',
      [id],
    );
    const row = rows.rows[0];
    if (!row || Number(row.revision) !== revision)
      throw new EditorialConflict('The story changed. Reload before restoring.');
    if (!row.archived_at) throw new Error('This story is already in the active library.');
    await db.query("UPDATE reference.stories SET archived_at=NULL,status='draft' WHERE id=$1", [
      id,
    ]);
    return { id, archived: false };
  });
}
