/**
 * Public BB-055 abuse-report endpoint for harassing or coordinated correction activity.
 */
import {
  buildDefaultCorrectionRouteDependencies,
  handleCorrectionAbuseReportRequest,
} from '../../api/handler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const deps = await buildDefaultCorrectionRouteDependencies();
  return handleCorrectionAbuseReportRequest(request, deps);
}
