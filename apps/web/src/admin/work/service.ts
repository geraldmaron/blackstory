import { ManagementWorkStore, WorkConflict, type WorkActor } from '@repo/ops-data/management';
import { dispatchManagementWork, githubWorkDispatcher } from '@repo/ops-data/management/dispatch';
import { getPostgresPool } from '../lib/canonical-postgres-client';
import {
  type ResolvedAdminCaller,
  authErrorResponse,
  isAdminAuthorizationError,
} from '../auth/request-auth';
import { staffRoleHasPermission } from '../auth/staff-permissions';

export const workStore = () => new ManagementWorkStore(getPostgresPool());
export const dispatchWork = (id: string) =>
  dispatchManagementWork(workStore(), id, githubWorkDispatcher());
export const workCapabilities = () => ({
  sessionResearch: true,
  hostedDispatchConfigured: Boolean(
    process.env.BLACKSTORY_WORK_DISPATCH_TOKEN &&
    process.env.BLACKSTORY_WORK_REPOSITORY &&
    process.env.BLACKSTORY_WORK_REF,
  ),
  sessionPublication: 'authenticated-runner',
});
export function workActor(caller: ResolvedAdminCaller): WorkActor {
  // OAuth client identity comes from the verified token, never a request body/header supplied by the agent.
  return {
    ownerId: caller.uid,
    canPublish: staffRoleHasPermission(caller.role, 'publication:publish'),
    canResearch: staffRoleHasPermission(caller.role, 'research:write'),
    ...(caller.admin.clientId ? { clientId: caller.admin.clientId } : {}),
  };
}
export function workError(error: unknown): Response {
  if (isAdminAuthorizationError(error)) return authErrorResponse(error);
  if (error instanceof WorkConflict)
    return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.name === 'ZodError')
    return Response.json({ error: 'Invalid work request' }, { status: 400 });
  console.error(
    'Management work operation failed',
    error instanceof Error ? error.name : 'unknown',
  );
  return Response.json({ error: 'Work is unavailable. Please retry.' }, { status: 503 });
}
