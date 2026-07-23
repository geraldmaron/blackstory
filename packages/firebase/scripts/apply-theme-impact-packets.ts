/**
 * Upserts ThemeImpactPacket fixtures into bb_reference.theme_impact_packets.
 * Source of truth: packages/firebase/fixtures/theme-impact/*.ts
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/apply-theme-impact-packets.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 APPLY_THEME_IMPACT_PACKETS=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/apply-theme-impact-packets.ts
 */
import pg from 'pg';
import { chicagoRedliningPilotPackets } from '../fixtures/theme-impact/chicago-redlining-packets.ts';
import { drugPolicyPilotPackets } from '../fixtures/theme-impact/drug-policy-packets.ts';
import { environmentalRacismPilotPackets } from '../fixtures/theme-impact/environmental-racism-packets.ts';
import { urbanRenewalPilotPackets } from '../fixtures/theme-impact/urban-renewal-packets.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

type PacketRow = {
  readonly id: string;
  readonly question_id: string;
  readonly theme_id: string;
  readonly title: string;
  readonly summary: string;
  readonly policy_eras: readonly string[];
  readonly geography: Record<string, unknown>;
  readonly method_stance: string;
  readonly method_note: string;
  readonly observations: readonly unknown[];
  readonly derived: readonly unknown[];
  readonly artifacts: readonly unknown[];
  readonly gap_states: readonly string[];
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
};

const ALL_PACKETS: readonly PacketRow[] = [
  ...chicagoRedliningPilotPackets,
  ...drugPolicyPilotPackets,
  ...environmentalRacismPilotPackets,
  ...urbanRenewalPilotPackets,
];

const UPSERT_SQL = `
INSERT INTO bb_reference.theme_impact_packets (
  id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states, status, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6::text[], $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::text[], $14,
  $15::timestamptz, $16::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  question_id = EXCLUDED.question_id,
  theme_id = EXCLUDED.theme_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  policy_eras = EXCLUDED.policy_eras,
  geography = EXCLUDED.geography,
  method_stance = EXCLUDED.method_stance,
  method_note = EXCLUDED.method_note,
  observations = EXCLUDED.observations,
  derived = EXCLUDED.derived,
  artifacts = EXCLUDED.artifacts,
  gap_states = EXCLUDED.gap_states,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at
RETURNING id;
`;

function countObservationRefs(packets: readonly PacketRow[]): number {
  return packets.reduce((sum, packet) => sum + packet.observations.length, 0);
}

async function applyPackets(databaseUrl: string): Promise<{ readonly ids: readonly string[] }> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  const ids: string[] = [];
  try {
    await client.query('BEGIN');
    for (const packet of ALL_PACKETS) {
      const result = await client.query<{ id: string }>(UPSERT_SQL, [
        packet.id,
        packet.question_id,
        packet.theme_id,
        packet.title,
        packet.summary,
        [...packet.policy_eras],
        JSON.stringify(packet.geography),
        packet.method_stance,
        packet.method_note,
        JSON.stringify(packet.observations),
        JSON.stringify(packet.derived),
        JSON.stringify(packet.artifacts),
        [...packet.gap_states],
        packet.status,
        packet.created_at,
        packet.updated_at,
      ]);
      ids.push(result.rows[0]!.id);
    }
    await client.query('COMMIT');
    return { ids };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const apply =
    process.env.APPLY_THEME_IMPACT_PACKETS === '1' && process.env.DRY_RUN !== '1';
  const databaseUrl = process.env.DATABASE_URL?.trim();

  const summary = ALL_PACKETS.map((packet) => ({
    id: packet.id,
    question_id: packet.question_id,
    status: packet.status,
    observationCount: packet.observations.length,
    derivedCount: packet.derived.length,
    artifactCount: packet.artifacts.length,
    gap_states: packet.gap_states,
  }));

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        packetCount: ALL_PACKETS.length,
        totalObservationRefs: countObservationRefs(ALL_PACKETS),
        packets: summary,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      'Dry-run only. Set APPLY_THEME_IMPACT_PACKETS=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when APPLY_THEME_IMPACT_PACKETS=1');
  }

  const { ids } = await applyPackets(databaseUrl);
  console.log(`Applied ${ids.length} theme_impact_packets: ${ids.join(', ')}`);
}

await main();
