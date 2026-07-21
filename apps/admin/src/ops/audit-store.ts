/** Admin reads for recent append-only Postgres audit events. */
import { listRecentAuditEventsPostgres } from '@/lib/postgres-ops-reads';

export type AuditEventListItem = {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly actorType: string;
  readonly actorDisplayName?: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly entityId?: string;
  readonly releaseId?: string;
};

export async function listRecentAuditEvents(limit = 100): Promise<readonly AuditEventListItem[]> {
  return listRecentAuditEventsPostgres(limit);
}

export async function tryListRecentAuditEvents(limit?: number): Promise<readonly AuditEventListItem[] | null> {
  try {
    return await listRecentAuditEvents(limit);
  } catch (error) {
    console.error('admin audit events list failed', error);
    return null;
  }
}
