/**
 * Enrich active-release related[] entries with viaEvent from event_participation.
 * Merges co-participation neighbors into projection.related (and top-level related jsonb
 * when present) so EntityRelatedList can render "through <event>" copy.
 *
 * Default dry-run. Apply:
 *   DRY_RUN=0 HYDRATE_VIA_EVENT_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/hydrate-via-event-neighbors.ts
 */
import pg from 'pg';
import {
  coParticipationNeighborsForEntity,
  type EventParticipationRow,
} from '../../domain/src/graph/co-participation.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.HYDRATE_VIA_EVENT_APPLY === '1';
const DISPLAY_CAP = 8;

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type RelatedEntry = {
  id: string;
  type: string;
  direction: 'outgoing' | 'incoming';
  viaEvent?: { id: string; displayName: string };
  timespan?: Record<string, unknown>;
};

function mergeViaEventRelated(
  existing: readonly RelatedEntry[],
  coNeighbors: readonly {
    readonly neighborId: string;
    readonly eventId: string;
    readonly eventDisplayName: string;
  }[],
): RelatedEntry[] {
  const byId = new Map<string, RelatedEntry>();
  for (const entry of existing) {
    byId.set(entry.id, { ...entry });
  }
  for (const neighbor of coNeighbors) {
    const prior = byId.get(neighbor.neighborId);
    const viaEvent = { id: neighbor.eventId, displayName: neighbor.eventDisplayName };
    if (prior) {
      byId.set(neighbor.neighborId, { ...prior, viaEvent });
    } else {
      byId.set(neighbor.neighborId, {
        id: neighbor.neighborId,
        type: 'related_to',
        direction: 'outgoing',
        viaEvent,
      });
    }
  }
  return [...byId.values()].slice(0, DISPLAY_CAP);
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const participation = await client.query<{
      event_id: string;
      participant_id: string;
      role: string;
    }>(
      `SELECT event_id, participant_id, role
       FROM bb_canonical.event_participation
       ORDER BY event_id, participant_id`,
    );
    const rows: EventParticipationRow[] = participation.rows.map((row) => ({
      eventId: row.event_id,
      participantId: row.participant_id,
      role: row.role,
    }));

    const eventIds = [...new Set(rows.map((row) => row.eventId))];
    const eventNames = await client.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM bb_canonical.entities WHERE id = ANY($1::text[])`,
      [eventIds],
    );
    const eventNamesById = new Map(eventNames.rows.map((row) => [row.id, row.display_name]));

    const participantIds = [...new Set(rows.map((row) => row.participantId))];
    const releaseRows = await client.query<{
      release_id: string;
      entity_id: string;
      related: unknown;
      projection: Record<string, unknown>;
    }>(
      `SELECT re.release_id, re.entity_id, re.related, re.projection
       FROM bb_public.release_entities re
       JOIN bb_public.active_release ar ON ar.release_id = re.release_id
       WHERE re.entity_id = ANY($1::text[])`,
      [participantIds],
    );

    console.log('=== Hydrate viaEvent neighbors ===');
    console.log(`Participation rows: ${rows.length}`);
    console.log(`Release entities with participation: ${releaseRows.rows.length}`);

    let wouldUpdate = 0;
    let updated = 0;

    for (const row of releaseRows.rows) {
      const coNeighbors = coParticipationNeighborsForEntity(row.entity_id, rows, eventNamesById);
      if (coNeighbors.length === 0) continue;

      const existingProjectionRelated = Array.isArray(row.projection.related)
        ? (row.projection.related as RelatedEntry[])
        : [];
      const existingTopRelated = Array.isArray(row.related)
        ? (row.related as RelatedEntry[])
        : existingProjectionRelated;

      const merged = mergeViaEventRelated(existingTopRelated, coNeighbors);
      const hadVia = existingTopRelated.some((entry) => entry.viaEvent?.id);
      const nextHasVia = merged.some((entry) => entry.viaEvent?.id);
      if (!nextHasVia) continue;
      if (
        hadVia &&
        JSON.stringify(existingTopRelated) === JSON.stringify(merged) &&
        JSON.stringify(existingProjectionRelated) === JSON.stringify(merged)
      ) {
        continue;
      }

      wouldUpdate += 1;
      console.log(
        `  ${row.entity_id}: +viaEvent on ${merged.filter((e) => e.viaEvent).length} related (of ${merged.length})`,
      );

      if (DRY_RUN || !APPLY) continue;

      const nextProjection = { ...row.projection, related: merged };
      const result = await client.query(
        `UPDATE bb_public.release_entities
         SET related = $3::jsonb,
             projection = $4::jsonb
         WHERE release_id = $1 AND entity_id = $2`,
        [row.release_id, row.entity_id, JSON.stringify(merged), JSON.stringify(nextProjection)],
      );
      updated += result.rowCount ?? 0;
    }

    if (DRY_RUN || !APPLY) {
      console.log(`\nDry run: would update ${wouldUpdate} release entities.`);
      console.log('Set DRY_RUN=0 HYDRATE_VIA_EVENT_APPLY=1 to apply.');
      return;
    }

    console.log(`\nApplied: updated ${updated} release entities.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
