/**
 * Public appeal endpoint for rejected corrections or disputed classifications.
 */
import {
  buildDefaultCorrectionRouteDependencies,
  handleCorrectionAppealRequest,
} from '../../api/handler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const deps = await buildDefaultCorrectionRouteDependencies();
  return handleCorrectionAppealRequest(request, deps);
}
