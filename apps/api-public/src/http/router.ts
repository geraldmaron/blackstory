/**
 * `/v1` route table + dispatch. Pure over `ApiRequest` → `ApiResponse`; the `node:http` adapter is
 * in `./server.ts`. Kept deliberately tiny (a switch over an enumerated table, not a framework):
 * per the bead, the API framework choice stays minimal and documented — see `./README.md`.
 */
import {
  handleBootstrap,
  handleCompatibility,
  handleEntity,
  handleHealth,
  handleSearch,
  type ApiRequest,
  type HandlerDeps,
} from './handlers.js';
import { errorResponse, type ApiResponse } from './responses.js';

const ENTITY_PATH = /^\/v1\/entity\/([^/]+)$/;

export async function dispatch(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  // Only GET/HEAD are served — this is a read surface (ADR-005); anything else is a 404-shaped
  // rejection (we do not advertise the route table via a 405 that distinguishes "wrong method").
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return notFound(request);
  }

  switch (request.path) {
    case '/v1/health':
      return handleHealth(request);
    case '/v1/compatibility':
      return handleCompatibility(request);
    case '/v1/bootstrap':
      return handleBootstrap(request, deps);
    case '/v1/search':
      return handleSearch(request, deps);
    default:
      break;
  }

  const entityMatch = ENTITY_PATH.exec(request.path);
  if (entityMatch?.[1]) {
    return handleEntity(request, decodeSegment(entityMatch[1]), deps);
  }

  return notFound(request);
}

/** A path segment may be percent-encoded; decode defensively (a malformed encoding is treated as
 * the raw segment, which then fails strict id validation in the handler). */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function notFound(request: ApiRequest): ApiResponse {
  return errorResponse('NOT_FOUND', 'No such resource.', { requestId: request.requestId });
}
