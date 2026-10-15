import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialBody, editorialError } from '@/admin/editorial/http';
import { applyEntityEditorial } from '@/admin/editorial/entities';
import { editorialWrite } from '@/admin/editorial/store';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminRoute(request),
      body = await editorialBody(request),
      id = (await params).id,
      reason = String(body.reason ?? '');
    if (body.decision === 'rejected')
      return Response.json(
        await editorialWrite(
          actor,
          'publication:publish',
          id,
          'entity.reject',
          reason,
          async (db) => {
            const row = await db.query(
              "UPDATE submissions.intake_items SET status='rejected',payload=payload||$2::jsonb WHERE id=$1 AND kind='entity_editorial' AND status='quarantined' RETURNING id",
              [
                id,
                JSON.stringify({ review: { actorId: actor.uid, reason, decision: 'rejected' } }),
              ],
            );
            if (!row.rows.length) throw new Error('Proposal no longer pending.');
            return { id };
          },
        ),
      );
    if (body.decision !== 'approved' || body.confirmed !== true)
      throw new Error('Confirm the evidence review.');
    const result = await applyEntityEditorial(actor, id, reason);
    if (result.status !== 'ok')
      return Response.json(
        { error: 'message' in result ? result.message : 'Sign in again.' },
        { status: result.status === 'forbidden' ? 403 : 400 },
      );
    return Response.json(result);
  } catch (e) {
    return editorialError(e);
  }
}
