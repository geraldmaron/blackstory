/**
 * Secondary Wayback SPN2 anchoring for capture-backfill. Submits through the domain
 * SPN client and merges the snapshot URL into source_captures.storage_object.
 * Failures skip; they never block the local capture.
 */
import {
  buildWaybackCaptureUrl,
  pollSpnStatus,
  submitSpnCapture,
  type SafeHttpClient,
  type SpnCredentials,
} from '@repo/domain';

export type WaybackAnchorAttempt =
  | {
      readonly status: 'anchored';
      readonly waybackCaptureUrl: string;
      readonly waybackCapturedAt: string;
    }
  | { readonly status: 'failed'; readonly reason: string };

export type WaybackAnchor = {
  captureUrl(targetUrl: string): Promise<WaybackAnchorAttempt>;
};

export type CreateWaybackAnchorInput = {
  readonly client: SafeHttpClient;
  readonly credentials: SpnCredentials;
  readonly now: () => string;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxAttempts?: number;
  readonly delayMs?: number;
};

/** Builds a testable SPN2 anchor. Production wires waybackSafeHttpClient + env credentials. */
export function createWaybackAnchor(input: CreateWaybackAnchorInput): WaybackAnchor {
  return {
    async captureUrl(targetUrl: string): Promise<WaybackAnchorAttempt> {
      try {
        const submitted = await submitSpnCapture(input.client, input.credentials, targetUrl);
        const status = await pollSpnStatus(input.client, submitted.jobId, {
          ...(input.sleep !== undefined ? { sleep: input.sleep } : {}),
          ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
          ...(input.delayMs !== undefined ? { delayMs: input.delayMs } : {}),
        });
        if (status.status !== 'success' || !status.timestamp) {
          return {
            status: 'failed',
            reason: status.message ?? `spn_${status.status}`,
          };
        }
        return {
          status: 'anchored',
          waybackCaptureUrl: buildWaybackCaptureUrl(
            status.timestamp,
            status.originalUrl ?? targetUrl,
          ),
          waybackCapturedAt: input.now(),
        };
      } catch (error) {
        return {
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/** Merges SPN2 outcome into the jsonb stored on source_captures.storage_object. */
export function attachWaybackMetadata(
  storageObject: Record<string, unknown>,
  attempt: WaybackAnchorAttempt,
): Record<string, unknown> {
  if (attempt.status === 'anchored') {
    return {
      ...storageObject,
      waybackStatus: 'anchored',
      waybackCaptureUrl: attempt.waybackCaptureUrl,
      waybackCapturedAt: attempt.waybackCapturedAt,
    };
  }
  return {
    ...storageObject,
    waybackStatus: 'failed',
    waybackReason: attempt.reason,
  };
}
