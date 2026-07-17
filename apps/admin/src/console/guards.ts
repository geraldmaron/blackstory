/**
 * Enforces server authorization, fresh-auth reasons, immutable publication boundaries,
 * and bounded bulk previews for every administration console mutation.
 */
import type {
  createServerAdminAuthorizer,
  AdminRequestHeaders,
} from '../auth/server-authorization.js';
import type { ConsoleAction, PublicationDiff } from './model.js';

export const MAX_BULK_ACTION_ITEMS = 50;

export type ConsoleActionAuthorizer = Pick<
  ReturnType<typeof createServerAdminAuthorizer>,
  'assertPermission' | 'assertPrivilegedAction'
>;

export type ConsoleActionRequest = {
  readonly headers: AdminRequestHeaders;
  readonly action: ConsoleAction;
  readonly reason?: string;
};

export type AuthorizedConsoleAction = {
  readonly actionId: string;
  readonly actorUid: string;
  readonly endpoint: ConsoleAction['endpoint'];
  readonly destination: ConsoleAction['destination'];
  readonly reason?: string;
  readonly publicationDiff: PublicationDiff;
};

export type BulkActionPreview = {
  readonly actionId: string;
  readonly itemIds: readonly string[];
  readonly itemCount: number;
  readonly rollbackToken: string;
  readonly publicationDiff: PublicationDiff;
  readonly executionAllowed: false;
};

export class ConsoleActionError extends Error {
  readonly code:
    | 'REASON_REQUIRED'
    | 'ACTIVE_PROJECTION_WRITE_PROHIBITED'
    | 'BULK_EMPTY'
    | 'BULK_LIMIT_EXCEEDED'
    | 'BULK_DUPLICATE_ITEM';

  constructor(code: ConsoleActionError['code'], message: string) {
    super(message);
    this.name = 'ConsoleActionError';
    this.code = code;
  }
}

export function assertNoActiveProjectionWrite(
  endpoint: string,
  destination: string,
): void {
  const normalizedEndpoint = endpoint.toLowerCase();
  if (
    destination === 'active-public-projection' ||
    normalizedEndpoint.startsWith('/api/public') ||
    normalizedEndpoint.includes('/active-projection')
  ) {
    throw new ConsoleActionError(
      'ACTIVE_PROJECTION_WRITE_PROHIBITED',
      'Console mutations cannot write active public projections; create a release candidate instead',
    );
  }
}

export async function authorizeConsoleAction(
  request: ConsoleActionRequest,
  authorizer: ConsoleActionAuthorizer,
): Promise<AuthorizedConsoleAction> {
  const reason = request.reason?.trim();
  const privilegedAction = request.action.privilegedAction;

  if (privilegedAction && !reason) {
    throw new ConsoleActionError(
      'REASON_REQUIRED',
      'High-impact actions require a durable operator reason',
    );
  }

  const identity = privilegedAction
    ? await authorizer.assertPrivilegedAction(request.headers, privilegedAction)
    : await authorizer.assertPermission(request.headers, request.action.permission);

  assertNoActiveProjectionWrite(request.action.endpoint, request.action.destination);

  return {
    actionId: request.action.id,
    actorUid: identity.admin.uid,
    endpoint: request.action.endpoint,
    destination: request.action.destination,
    ...(reason ? { reason } : {}),
    publicationDiff: request.action.publicationDiff,
  };
}

function rollbackToken(actionId: string, itemIds: readonly string[]): string {
  const fingerprint = itemIds.join('|').split('').reduce((sum, value) => sum + value.charCodeAt(0), 0);
  return `rollback:${actionId}:${itemIds.length}:${fingerprint.toString(36)}`;
}

export function previewBulkAction(
  action: ConsoleAction,
  itemIds: readonly string[],
): BulkActionPreview {
  const configuredLimit = action.bulk?.maximumItems ?? MAX_BULK_ACTION_ITEMS;
  const limit = Math.min(configuredLimit, MAX_BULK_ACTION_ITEMS);
  if (itemIds.length === 0) {
    throw new ConsoleActionError('BULK_EMPTY', 'Bulk previews require at least one item');
  }
  if (itemIds.length > limit) {
    throw new ConsoleActionError(
      'BULK_LIMIT_EXCEEDED',
      `Bulk action limit is ${limit} items`,
    );
  }
  if (new Set(itemIds).size !== itemIds.length) {
    throw new ConsoleActionError(
      'BULK_DUPLICATE_ITEM',
      'Bulk previews cannot contain duplicate item identifiers',
    );
  }

  return {
    actionId: action.id,
    itemIds: [...itemIds],
    itemCount: itemIds.length,
    rollbackToken: rollbackToken(action.id, itemIds),
    publicationDiff: action.publicationDiff,
    executionAllowed: false,
  };
}
