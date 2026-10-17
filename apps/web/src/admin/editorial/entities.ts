/** Entity editorial proposals use the existing quarantined intake and canonical audit boundary. */
import { randomUUID } from 'node:crypto';
import { entityEditorialProposalSchema, type EntityEditorialProposal } from '@repo/schemas';
import { storyCitedEntities } from '@repo/domain/publication/cites-edge';
import { workDigest } from '@repo/ops-data/management';
import { managementEntitySnapshot } from '@repo/ops-data/management/catalog';
import { getPostgresPool, queryPostgres } from '../lib/canonical-postgres-client';
import { editorialWrite, EditorialConflict, type Actor } from './store';
import { commitCanonicalWrite } from '../lib/canonical-write';
import { insertSourceAndEvidence } from '../cases/promote-case';
import { storyDraftSchema } from '@repo/schemas';
import {
  rowToProjectionAuthoring,
  type StoryRow,
  REFERENCE_COLUMNS,
} from '../../../../../packages/ops-data/scripts/lib/story-lifecycle';
export async function readEntityEditorial(id: string) {
  const snapshot = await managementEntitySnapshot(getPostgresPool(), id);
  if (!snapshot) return null;
  const [stories, published, proposals, relationships] = await Promise.all([
    queryPostgres<StoryRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.stories WHERE $1=ANY(related_entity_ids) OR body @> $2::jsonb`,
      [id, JSON.stringify([{ type: 'mapInset', entityId: id }])],
    ),
    queryPostgres(
      "SELECT payload FROM published.release_stories a JOIN published.active_release r ON r.release_id=a.release_id AND r.id='active' WHERE payload->'relatedEntityIds' ? $1 OR payload->'body' @> $2::jsonb",
      [id, JSON.stringify([{ type: 'mapInset', entityId: id }])],
    ),
    queryPostgres<{ id: string; payload: { proposal: EntityEditorialProposal }; status: string }>(
      "SELECT id,payload,status FROM submissions.intake_items WHERE kind='entity_editorial' AND payload->'proposal'->>'entityId'=$1 ORDER BY created_at DESC LIMIT 30",
      [id],
    ),
    queryPostgres(
      'SELECT r.*,e.display_name AS target_name FROM canonical.entity_relationships r JOIN canonical.entities e ON e.id=r.to_entity_id WHERE r.from_entity_id=$1 ORDER BY r.relationship_type,r.to_entity_id',
      [id],
    ),
  ]);
  const editorial = snapshot.entity.kind_detail?.editorial ?? {};
  return {
    beforeHash: workDigest(snapshot),
    summary: String(editorial.summary ?? ''),
    historicalContext: String(editorial.historicalContext ?? ''),
    stories: stories.map((row) => {
      const draft = storyDraftSchema.parse(rowToProjectionAuthoring(row));
      return {
        slug: row.slug,
        title: row.title,
        relation: storyCitedEntities({ ...draft, releaseId: 'draft' }).get(id),
      };
    }),
    published: published.map((row) => ({ slug: row.payload.slug, title: row.payload.title })),
    proposals: [...proposals],
    relationships,
  };
}
export async function proposeEntityEditorial(actor: Actor, raw: unknown, reason: string) {
  const proposal = entityEditorialProposalSchema.parse(raw);
  if (
    proposal.relationships.some(
      (r) => r.evidenceIndex >= proposal.evidence.length || r.targetId === proposal.entityId,
    )
  )
    throw new Error('Each relationship needs a different target and a supporting evidence item.');
  return editorialWrite(
    actor,
    'research:write',
    proposal.entityId,
    'entity.propose',
    reason,
    async (db) => {
      const before = await managementEntitySnapshot(db, proposal.entityId);
      if (
        !before ||
        before.entity.merge_state?.status === 'absorbed' ||
        workDigest(before) !== proposal.beforeHash
      )
        throw new EditorialConflict(
          'The record changed. Reload it before proposing this revision.',
        );
      for (const target of proposal.relationships) {
        const found = await db.query(
          "SELECT id FROM canonical.entities WHERE id=$1 AND COALESCE(merge_state->>'status','')<>'absorbed'",
          [target.targetId],
        );
        if (!found.rows.length) throw new Error('A relationship target is missing or merged.');
      }
      const id = randomUUID();
      await db.query(
        "INSERT INTO submissions.intake_items(id,created_by,kind,payload) VALUES($1,$2,'entity_editorial',$3::jsonb)",
        [id, actor.uid, JSON.stringify({ proposal, reason })],
      );
      return { id };
    },
  );
}
export async function applyEntityEditorial(actor: Actor, proposalId: string, reason: string) {
  const pending = await queryPostgres<{ payload: { proposal: EntityEditorialProposal } }>(
    "SELECT payload FROM submissions.intake_items WHERE id=$1 AND kind='entity_editorial'",
    [proposalId],
  );
  if (!pending[0]) throw new Error('Proposal not found.');
  const entityId = entityEditorialProposalSchema.parse(pending[0].payload.proposal).entityId;
  return commitCanonicalWrite(
    {
      verb: 'entity.editorial_apply',
      subjectId: entityId,
      reason,
      async applyState(db) {
        const rows = await db.query(
          "SELECT payload,status FROM submissions.intake_items WHERE id=$1 AND kind='entity_editorial' FOR UPDATE",
          [proposalId],
        );
        const row = rows.rows[0];
        if (!row || row.status !== 'quarantined')
          throw new Error('This proposal is no longer waiting for review.');
        const proposal = entityEditorialProposalSchema.parse(row.payload.proposal);
        await db.query('SELECT id FROM canonical.entities WHERE id=$1 FOR UPDATE', [
          proposal.entityId,
        ]);
        const before = await managementEntitySnapshot(db, proposal.entityId);
        if (
          !before ||
          before.entity.merge_state?.status === 'absorbed' ||
          workDigest(before) !== proposal.beforeHash
        )
          throw new Error('The record changed after this proposal. Submit a new revision.');
        const ids: string[] = [];
        // Identity comes from commitCanonicalWrite; no posted operator can impersonate a reviewer.
        for (const source of proposal.evidence) {
          const saved = await insertSourceAndEvidence(
            db,
            { ...source, fitness: 'strong' },
            actor.uid,
            new Date().toISOString(),
          );
          ids.push(saved.evidenceId);
        }
        const editorial = {
          ...before.entity.kind_detail?.editorial,
          summary: proposal.summary,
          historicalContext: proposal.historicalContext,
          evidenceIds: ids,
        };
        await db.query(
          "UPDATE canonical.entities SET kind_detail=jsonb_set(COALESCE(kind_detail,'{}'::jsonb),'{editorial}',$2::jsonb),updated_at=now() WHERE id=$1",
          [proposal.entityId, JSON.stringify(editorial)],
        );
        for (const relation of proposal.relationships) {
          const id = `rel_${randomUUID()}`;
          await db.query(
            `INSERT INTO canonical.entity_relationships(id,from_entity_id,to_entity_id,relationship_type,role,workflow_status,publication_status) VALUES($1,$2,$3,$4,$5,'reviewed','unpublished')`,
            [id, proposal.entityId, relation.targetId, relation.predicate, relation.statement],
          );
          await db.query(
            'INSERT INTO canonical.entity_relationship_evidence(relationship_id,evidence_id) VALUES($1,$2)',
            [id, ids[relation.evidenceIndex]],
          );
        }
        await db.query("UPDATE submissions.intake_items SET status='promoted' WHERE id=$1", [
          proposalId,
        ]);
        return {
          entityId: proposal.entityId,
          before: before.entity.kind_detail?.editorial,
          after: editorial,
          proposalId,
        };
      },
    },
    { readIdentity: async () => actor },
  );
}
