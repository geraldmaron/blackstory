/**
 * Backfill bb_canonical.event_participation from entity_relationships (participated_in,
 * attended, person/org occurred_at) and event mentionedEntityIds in release projections.
 * Optionally links lynching victim persons to existing kind=event lynching records (never
 * mints new events).
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-event-participation.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_EVENT_PARTICIPATION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-event-participation.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_EVENT_PARTICIPATION_APPLY === '1';

type ParticipationDraft = {
  readonly id: string;
  readonly eventId: string;
  readonly participantId: string;
  readonly role: string;
  readonly validEdtf: string | null;
  readonly evidenceIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly provenance: Record<string, unknown>;
};

const RELATIONSHIP_SQL = `
SELECT
  r.id AS relationship_id,
  r.from_entity_id,
  e_from.kind AS from_kind,
  r.to_entity_id,
  e_to.kind AS to_kind,
  r.relationship_type,
  r.role,
  r.valid_from_edtf,
  COALESCE(
    (
      SELECT array_agg(ere.evidence_id ORDER BY ere.evidence_id)
      FROM bb_canonical.entity_relationship_evidence ere
      WHERE ere.relationship_id = r.id
    ),
    '{}'::text[]
  ) AS evidence_ids
FROM bb_canonical.entity_relationships r
JOIN bb_canonical.entities e_from ON e_from.id = r.from_entity_id
JOIN bb_canonical.entities e_to ON e_to.id = r.to_entity_id
WHERE r.relationship_type IN ('participated_in', 'attended')
   OR (
     r.relationship_type = 'occurred_at'
     AND e_from.kind = 'event'
     AND e_to.kind NOT IN ('place', 'school', 'institution')
   )
   OR (
     r.relationship_type = 'related_to'
     AND (
       (e_from.kind = 'event' AND e_to.kind IN ('person', 'organization', 'movement'))
       OR (e_to.kind = 'event' AND e_from.kind IN ('person', 'organization', 'movement'))
     )
   )
ORDER BY r.id
`;

const MENTION_SQL = `
SELECT
  re.entity_id AS event_id,
  jsonb_array_elements_text(COALESCE(re.projection->'mentionedEntityIds', '[]'::jsonb)) AS participant_id
FROM bb_public.release_entities re
JOIN bb_public.active_release ar ON re.release_id = ar.release_id
JOIN bb_canonical.entities e ON e.id = re.entity_id
WHERE e.kind = 'event'
ORDER BY re.entity_id
`;

const LYNCHING_VICTIM_EVENT_SQL = `
SELECT
  v.id AS victim_id,
  ev.id AS event_id
FROM bb_canonical.entities v
JOIN bb_canonical.entities ev
  ON ev.kind = 'event'
 AND (
   ev.id = regexp_replace(v.id, '^lynching_([^_]+(?:_[^_]+)*)_[^_]+_[^_]+$', 'lynching_\\1')
   OR (
     v.id LIKE '%_duluth_%'
     AND ev.display_name ILIKE '%duluth%'
     AND ev.display_name ILIKE '%lynch%'
   )
 )
WHERE v.kind = 'person'
  AND v.id LIKE 'lynching_%'
ORDER BY v.id, ev.id
`;

const COVERAGE_SQL = `
SELECT
  (SELECT COUNT(*)::int FROM bb_canonical.entities WHERE kind = 'event') AS total_events,
  (SELECT COUNT(DISTINCT event_id)::int FROM bb_canonical.event_participation) AS events_with_participants,
  (SELECT COUNT(*)::int FROM bb_canonical.event_participation) AS participation_rows
`;

function participationId(eventId: string, participantId: string, role: string): string {
  return `ep_${eventId}_${participantId}_${role}`.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 180);
}

function defaultRole(relationshipType: string, explicitRole: string | null): string {
  if (explicitRole?.trim()) return explicitRole.trim();
  if (relationshipType === 'attended') return 'attendee';
  if (relationshipType === 'participated_in') return 'participant';
  if (relationshipType === 'related_to') return 'associated';
  if (relationshipType === 'occurred_at') return 'participant';
  return 'participant';
}

function resolveEventParticipant(
  fromEntityId: string,
  fromKind: string,
  toEntityId: string,
  toKind: string,
): { readonly eventId: string; readonly participantId: string } | null {
  if (toKind === 'event' && fromKind !== 'event') {
    return { eventId: toEntityId, participantId: fromEntityId };
  }
  if (fromKind === 'event' && toKind !== 'event') {
    return { eventId: fromEntityId, participantId: toEntityId };
  }
  return null;
}

function upsertKey(eventId: string, participantId: string, role: string): string {
  return `${eventId}|${participantId}|${role}`;
}

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const drafts = new Map<string, ParticipationDraft>();

    const relRows = (
      await client.query<{
        relationship_id: string;
        from_entity_id: string;
        from_kind: string;
        to_entity_id: string;
        to_kind: string;
        relationship_type: string;
        role: string | null;
        valid_from_edtf: string | null;
        evidence_ids: string[];
      }>(RELATIONSHIP_SQL)
    ).rows;

    for (const row of relRows) {
      const endpoints = resolveEventParticipant(
        row.from_entity_id,
        row.from_kind,
        row.to_entity_id,
        row.to_kind,
      );
      if (!endpoints) continue;
      const role = defaultRole(row.relationship_type, row.role);
      const key = upsertKey(endpoints.eventId, endpoints.participantId, role);
      if (drafts.has(key)) continue;
      drafts.set(key, {
        id: participationId(endpoints.eventId, endpoints.participantId, role),
        eventId: endpoints.eventId,
        participantId: endpoints.participantId,
        role,
        validEdtf: row.valid_from_edtf,
        evidenceIds: row.evidence_ids,
        claimIds: [],
        provenance: {
          source: 'entity_relationship',
          relationshipId: row.relationship_id,
          relationshipType: row.relationship_type,
        },
      });
    }

    const mentionRows = (
      await client.query<{ event_id: string; participant_id: string }>(MENTION_SQL)
    ).rows;
    for (const row of mentionRows) {
      if (row.participant_id === row.event_id) continue;
      const role = 'mentioned';
      const key = upsertKey(row.event_id, row.participant_id, role);
      if (drafts.has(key)) continue;
      drafts.set(key, {
        id: participationId(row.event_id, row.participant_id, role),
        eventId: row.event_id,
        participantId: row.participant_id,
        role,
        validEdtf: null,
        evidenceIds: [],
        claimIds: [],
        provenance: {
          source: 'release_mention',
          eventId: row.event_id,
        },
      });
    }

    const lynchingRows = (
      await client.query<{ victim_id: string; event_id: string }>(LYNCHING_VICTIM_EVENT_SQL)
    ).rows;
    for (const row of lynchingRows) {
      const role = 'victim';
      const key = upsertKey(row.event_id, row.victim_id, role);
      if (drafts.has(key)) continue;
      drafts.set(key, {
        id: participationId(row.event_id, row.victim_id, role),
        eventId: row.event_id,
        participantId: row.victim_id,
        role,
        validEdtf: null,
        evidenceIds: [],
        claimIds: [],
        provenance: {
          source: 'lynching_victim_link',
          victimId: row.victim_id,
        },
      });
    }

    const draftList = [...drafts.values()].sort((a, b) => a.id.localeCompare(b.id));

    console.log('=== Backfill event_participation ===');
    console.log(`Draft rows: ${draftList.length}`);
    console.log(`  from relationships: ${relRows.length} scanned`);
    console.log(`  from event mentions: ${mentionRows.length} mention tokens`);
    console.log(`  lynching victim links: ${lynchingRows.length}`);

    for (const row of draftList.slice(0, 12)) {
      console.log(`  ${row.eventId} <- ${row.participantId} (${row.role})`);
    }
    if (draftList.length > 12) console.log(`  ...and ${draftList.length - 12} more`);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_EVENT_PARTICIPATION_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      let inserted = 0;
      for (const row of draftList) {
        const result = await client.query(
          `INSERT INTO bb_canonical.event_participation (
             id, event_id, participant_id, role, status_at_event, valid_edtf,
             evidence_ids, claim_ids, provenance
           ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8::jsonb)
           ON CONFLICT (event_id, participant_id, role) DO NOTHING`,
          [
            row.id,
            row.eventId,
            row.participantId,
            row.role,
            row.validEdtf,
            row.evidenceIds,
            row.claimIds,
            JSON.stringify(row.provenance),
          ],
        );
        inserted += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
      console.log(`\nInserted ${inserted} participation rows (conflicts skipped).`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const coverage = (await client.query(COVERAGE_SQL)).rows[0] as {
      total_events: number;
      events_with_participants: number;
      participation_rows: number;
    };
    const pct =
      coverage.total_events > 0
        ? ((coverage.events_with_participants / coverage.total_events) * 100).toFixed(1)
        : '0.0';
    console.log('\n=== Coverage ===');
    console.log(`Events total: ${coverage.total_events}`);
    console.log(`Events with >=1 participant: ${coverage.events_with_participants} (${pct}%)`);
    console.log(`Participation rows: ${coverage.participation_rows}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
