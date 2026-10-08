/** Delegation is granted and revoked by the signed-in owner, never by the agent itself. */
import { z } from 'zod/v4';
import { type ManagementWorkStore, WorkConflict, type WorkActor } from './work-store.js';
const grantSchema = z
  .object({
    clientId: z.string().trim().min(1).max(200),
    sessionId: z.string().trim().min(1).max(200),
    hours: z.number().int().min(1).max(24),
  })
  .strict();
export async function manageDelegations(
  store: ManagementWorkStore,
  actor: WorkActor,
  body?: unknown,
) {
  if (actor.clientId || !actor.canPublish)
    throw new WorkConflict('Only the signed-in publishing owner can manage agent connections');
  if (body !== undefined) {
    const revoke = z.object({ revokeId: z.string().uuid() }).strict().safeParse(body);
    if (revoke.success)
      await store.pool.query(
        'UPDATE research.management_delegations SET revoked_at=now() WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL',
        [revoke.data.revokeId, actor.ownerId],
      );
    else {
      const grant = grantSchema.parse(body);
      await store.pool.query(
        `INSERT INTO research.management_delegations(owner_id,client_id,session_id,expires_at)
        VALUES($1,$2,$3,now()+$4*interval '1 hour')`,
        [actor.ownerId, grant.clientId, grant.sessionId, grant.hours],
      );
    }
  }
  const result = await store.pool.query(
    `SELECT id,client_id,session_id,expires_at,revoked_at FROM research.management_delegations
    WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [actor.ownerId],
  );
  return result.rows;
}
