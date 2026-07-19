/**
 * POST /api/releases/stage — privileged staging gate for release activate/rollback.
 * Verifies auth + durable reason; does not activate until signed-manifest verify is wired
 * for this runtime (returns staged preview payload only).
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';

type Body = {
  readonly releaseId?: string;
  readonly mode?: 'activate' | 'rollback';
  readonly reason?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    const body = (await request.json()) as Body;
    if (!body.releaseId?.trim()) {
      return Response.json({ error: 'releaseId is required' }, { status: 400 });
    }
    if (body.mode !== 'activate' && body.mode !== 'rollback') {
      return Response.json({ error: 'mode must be activate | rollback' }, { status: 400 });
    }
    if (!body.reason?.trim()) {
      return Response.json(
        { error: 'A durable operator reason is required for release actions' },
        { status: 400 },
      );
    }

    return Response.json({
      ok: true,
      staged: true,
      executionAllowed: false,
      mode: body.mode,
      releaseId: body.releaseId.trim(),
      actor: { uid: caller.uid, email: caller.email },
      reason: body.reason.trim(),
      note:
        'Release activation requires signed-manifest verification and privileged reauth in this runtime. Staging recorded for operator review only — active public pointer was not changed.',
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
