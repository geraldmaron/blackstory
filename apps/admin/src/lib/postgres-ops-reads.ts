/**
 * Postgres reads for bb_ops kill switches, bb_audit events, and discovery campaign runs.
 */
import { queryPostgres } from './postgres-client.js';

export type KillSwitchListItem = {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly updatedAt: string;
};

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

export type DiscoveryCampaignRunListItem = {
  readonly id: string;
  readonly jobId: string;
  readonly jobRunId: string;
  readonly status: string;
  readonly mode: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly itemsExpected: number;
  readonly itemsProcessed: number;
  readonly survivors?: number;
  readonly accepted?: number;
  readonly kind?: string;
  readonly errorMessage?: string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type KillSwitchRow = {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason: string | null;
  readonly updated_at: Date | string;
};

export async function listKillSwitchesPostgres(limit: number): Promise<readonly KillSwitchListItem[]> {
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const rows = await queryPostgres<KillSwitchRow>(
    `SELECT id, enabled, reason, updated_at
     FROM bb_ops.kill_switches
     ORDER BY id ASC
     LIMIT $1`,
    [cappedLimit],
  );
  return rows.map((row) => {
    const reason = readString(row.reason);
    return {
      id: row.id,
      enabled: row.enabled,
      updatedAt: toIso(row.updated_at),
      ...(reason ? { reason } : {}),
    };
  });
}

type AuditRow = {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  readonly actor: Record<string, unknown>;
  readonly subject: Record<string, unknown>;
  readonly reason: string;
  readonly entity_id: string | null;
  readonly release_id: string | null;
  readonly occurred_at: Date | string;
};

export async function listRecentAuditEventsPostgres(
  limit: number,
): Promise<readonly AuditEventListItem[]> {
  const cappedLimit = Math.min(100, Math.max(1, limit));
  const rows = await queryPostgres<AuditRow>(
    `SELECT id, action, category, actor, subject, reason, entity_id, release_id, occurred_at
     FROM bb_audit.events
     ORDER BY occurred_at DESC
     LIMIT $1`,
    [cappedLimit],
  );

  const items: AuditEventListItem[] = [];
  for (const row of rows) {
    const actorId = readString(row.actor.id);
    const actorType = readString(row.actor.type);
    const subjectId = readString(row.subject.id);
    const subjectType = readString(row.subject.type);
    if (!actorId || !actorType || !subjectId || !subjectType) continue;
    const actorDisplayName = readString(row.actor.displayName);
    const entityId = readString(row.entity_id ?? undefined);
    const releaseId = readString(row.release_id ?? undefined);
    items.push({
      id: row.id,
      action: row.action,
      category: row.category,
      occurredAt: toIso(row.occurred_at),
      actorId,
      actorType,
      subjectType,
      subjectId,
      reason: row.reason,
      ...(actorDisplayName ? { actorDisplayName } : {}),
      ...(entityId ? { entityId } : {}),
      ...(releaseId ? { releaseId } : {}),
    });
  }
  return items;
}

type DiscoveryRunRow = {
  readonly id: string;
  readonly job_id: string;
  readonly job_run_id: string;
  readonly status: string;
  readonly mode: string;
  readonly started_at: Date | string;
  readonly completed_at: Date | string | null;
  readonly accepted_count: number;
  readonly survivor_count: number;
  readonly kind: string | null;
  readonly error_message: string | null;
};

export async function listDiscoveryCampaignRunsPostgres(
  limit: number,
): Promise<readonly DiscoveryCampaignRunListItem[]> {
  const cappedLimit = Math.min(100, Math.max(1, limit));
  const rows = await queryPostgres<DiscoveryRunRow>(
    `SELECT id, job_id, job_run_id, status, mode, started_at, completed_at,
            accepted_count, survivor_count, kind, error_message
     FROM bb_ops.discovery_campaign_runs
     ORDER BY coalesce(completed_at, started_at) DESC
     LIMIT $1`,
    [cappedLimit],
  );

  return rows.map((row) => {
    const completedAt = row.completed_at ? toIso(row.completed_at) : toIso(row.started_at);
    const accepted = row.accepted_count;
    const survivors = row.survivor_count;
    const kind = readString(row.kind ?? undefined);
    const errorMessage = readString(row.error_message ?? undefined);
    return {
      id: row.id,
      jobId: row.job_id,
      jobRunId: row.job_run_id,
      status: row.status,
      mode: row.mode,
      startedAt: toIso(row.started_at),
      completedAt,
      itemsExpected: accepted,
      itemsProcessed: accepted,
      ...(survivors > 0 ? { survivors } : {}),
      ...(accepted > 0 ? { accepted } : {}),
      ...(kind ? { kind } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    };
  });
}
