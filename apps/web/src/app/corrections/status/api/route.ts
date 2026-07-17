/**
 * Public correction status lookup by receipt code. Returns coarse public phases only 
 * never moderation-sensitive campaign, spam, or duplicate metadata.
 */
import {
  buildDefaultCorrectionRouteDependencies,
  handleCorrectionStatusRequest,
} from '../../api/handler';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const deps = await buildDefaultCorrectionRouteDependencies();
  return handleCorrectionStatusRequest(request, deps);
}
