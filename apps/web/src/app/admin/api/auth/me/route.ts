/**
 * API: return the current admin session from a verified Supabase access token.
 */
import { authorizeAdminRoute, authErrorResponse } from '../../../../../admin/auth/request-auth';
import { resolveAdminAuthMode } from '../../../../../admin/auth/mode';

export async function GET(request: Request): Promise<Response> {
  try {
    const caller = await authorizeAdminRoute(request);
    return Response.json({
      email: caller.email,
      uid: caller.uid,
      role: caller.role,
      mode: caller.mode,
      authMode: resolveAdminAuthMode(),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
