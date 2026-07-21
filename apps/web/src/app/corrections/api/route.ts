/**
 * Public correction intake endpoint. Node.js runtime. Behind request-integrity + rate limits;
 * writes create-only into quarantine via `createQuarantinedSubmission`.
 */
import { buildDefaultCorrectionRouteDependencies, handleCorrectionSubmitRequest } from './handler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const deps = await buildDefaultCorrectionRouteDependencies();
  return handleCorrectionSubmitRequest(request, deps);
}
