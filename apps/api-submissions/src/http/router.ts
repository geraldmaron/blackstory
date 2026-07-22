/**
 * `/v1/corrections` route table + dispatch for api-submissions (MOB-016 / repo-zir9).
 * Pure over `ApiRequest` → `ApiResponse`; the `node:http` adapter lives in `./server.ts`.
 */
import {
  CORRECTION_STATUS_PATH,
  CORRECTION_SUBMIT_PATH,
  handleCorrectionStatus,
  handleCorrectionSubmit,
  handleHealth,
  type ApiRequest,
  type HandlerDeps,
} from './handlers.js';
import { jsonError, type ApiResponse } from './responses.js';

export async function dispatch(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  if (request.path === '/v1/health') {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return handleHealth(request);
    }
    return jsonError(404, 'not_found', request.requestId);
  }

  if (request.path === CORRECTION_SUBMIT_PATH && request.method === 'POST') {
    return handleCorrectionSubmit(request, deps);
  }

  if (request.path === CORRECTION_STATUS_PATH && request.method === 'POST') {
    return handleCorrectionStatus(request, deps);
  }

  return jsonError(404, 'not_found', request.requestId);
}
