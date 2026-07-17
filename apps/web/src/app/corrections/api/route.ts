/**
 * Public BB-055 correction intake endpoint. Node.js runtime (App Check Admin verifier).
 * Writes create-only into BB-029 quarantine via `createQuarantinedSubmission`.
 */
import {
  buildDefaultCorrectionRouteDependencies,
  handleCorrectionSubmitRequest,
} from './handler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const deps = await buildDefaultCorrectionRouteDependencies();
  return handleCorrectionSubmitRequest(request, deps);
}
