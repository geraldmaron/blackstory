/**
 * API: return the current admin session from a verified Firebase ID token.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { resolveAdminAuthMode } from '../../../../auth/mode';

export async function GET(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRequest(request.headers);
    return Response.json({
      email: caller.email,
      uid: caller.uid,
      mode: caller.mode,
      authMode: resolveAdminAuthMode(),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
