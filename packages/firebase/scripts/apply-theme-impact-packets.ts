/**
 * Upserts canonical researched Q1–Q12 packets into bb_reference.theme_impact_packets.
 * Source of truth: packages/domain/src/statistics/researched-theme-impact-packets.ts
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
import {
  assertThemeImpactPacketPublishable,
  RESEARCHED_THEME_IMPACT_PACKETS,
  type ThemeImpactPacket,
  type ThemeImpactPacketDerived,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const ALL_PACKETS = RESEARCHED_THEME_IMPACT_PACKETS;
const RETIRED_PACKET_IDS = ['tip_environmental_racism_q9_cook'] as const;

const UPSERT_SQL = `
INSERT INTO bb_reference.theme_impact_packets (
  id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states,
  causal_claim_ids, entity_id, binding_purpose, status, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6::text[], $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb,
  $13::text[], $14::text[], $15, $16, $17, $18::timestamptz, $19::timestamptz
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
  causal_claim_ids = EXCLUDED.causal_claim_ids,
  entity_id = EXCLUDED.entity_id,
  binding_purpose = EXCLUDED.binding_purpose,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at
RETURNING id;
`;

const UPSERT_DERIVED_SQL = `
INSERT INTO bb_reference.derived_measurements (
  id, method_id, method_version, input_observation_ids, value, formula,
  assumptions, status, generated_at, jurisdiction_id, reference_period,
  source, source_url, content_hash, metadata
) VALUES (
  $1, $2, $3, $4::text[], $5, $6, $7::text[], $8, $9::timestamptz,
  $10, $11, $12, $13, $14, $15::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  method_id = EXCLUDED.method_id,
  method_version = EXCLUDED.method_version,
  input_observation_ids = EXCLUDED.input_observation_ids,
  value = EXCLUDED.value,
  formula = EXCLUDED.formula,
  assumptions = EXCLUDED.assumptions,
  status = EXCLUDED.status,
  generated_at = EXCLUDED.generated_at,
  jurisdiction_id = EXCLUDED.jurisdiction_id,
  reference_period = EXCLUDED.reference_period,
  source = EXCLUDED.source,
  source_url = EXCLUDED.source_url,
  content_hash = EXCLUDED.content_hash,
  metadata = EXCLUDED.metadata
RETURNING id;
`;

function countObservationRefs(packets: readonly ThemeImpactPacket[]): number {
  return packets.reduce((sum, packet) => sum + packet.observations.length, 0);
}

function uniqueDerivedRows(
  packets: readonly ThemeImpactPacket[],
): readonly { readonly row: ThemeImpactPacketDerived; readonly packet: ThemeImpactPacket }[] {
  const byId = new Map<
    string,
    { readonly row: ThemeImpactPacketDerived; readonly packet: ThemeImpactPacket }
  >();
  for (const packet of packets) {
    for (const row of packet.derived) {
      const prior = byId.get(row.derivedId);
      if (
        prior &&
        prior.row.provenance.contentHash !== row.provenance.contentHash
      ) {
        throw new Error(`derived measurement ${row.derivedId} has conflicting definitions`);
      }
      byId.set(row.derivedId, { row, packet });
    }
  }
  return [...byId.values()];
}

function derivedJurisdictionId(
  row: ThemeImpactPacketDerived,
  packet: ThemeImpactPacket,
): string | null {
  const ids = new Set<string>();
  for (const observationId of row.inputObservationIds) {
    const match = observationId.match(/:(county:\d+|state:\d+|nation:US):/);
    if (match?.[1]) ids.add(match[1]);
  }
  if (ids.size === 1) return [...ids][0]!;
  return packet.geography.jurisdictionId ?? null;
}

async function verifyCanonicalObservationInputs(
  client: pg.PoolClient,
): Promise<{
  readonly packetObservationCount: number;
  readonly totalInputObservationCount: number;
}> {
  const packetObservations = new Map(
    ALL_PACKETS.flatMap((packet) =>
      packet.observations.map((row) => [row.observationId, row] as const),
    ),
  );
  const inputIds = new Set(packetObservations.keys());
  for (const packet of ALL_PACKETS) {
    for (const row of packet.derived) {
      for (const inputId of row.inputObservationIds) inputIds.add(inputId);
    }
  }

  const result = await client.query<{
    id: string;
    metric_id: string;
    estimate: number;
    reference_period: string;
    source: string;
    source_url: string;
    content_hash: string;
  }>(
    `SELECT id, metric_id, estimate, reference_period, source, source_url, content_hash
     FROM bb_reference.statistical_observations
     WHERE id = ANY($1::text[])`,
    [[...inputIds]],
  );
  const canonicalById = new Map(result.rows.map((row) => [row.id, row]));
  const missingIds = [...inputIds].filter((id) => !canonicalById.has(id));
  if (missingIds.length > 0) {
    throw new Error(
      `missing ${missingIds.length} canonical observation inputs: ${missingIds.slice(0, 10).join(', ')}`,
    );
  }

  for (const [id, packetRow] of packetObservations) {
    const canonical = canonicalById.get(id)!;
    const mismatches = [
      canonical.metric_id !== packetRow.metricId ? 'metricId' : undefined,
      canonical.estimate !== packetRow.estimate ? 'estimate' : undefined,
      canonical.reference_period !== packetRow.referencePeriod
        ? 'referencePeriod'
        : undefined,
      canonical.source !== packetRow.provenance.source ? 'source' : undefined,
      canonical.source_url !== packetRow.provenance.sourceUrl ? 'sourceUrl' : undefined,
      canonical.content_hash !== packetRow.provenance.contentHash
        ? 'contentHash'
        : undefined,
    ].filter((value): value is string => value !== undefined);
    if (mismatches.length > 0) {
      throw new Error(
        `packet observation ${id} differs from canonical row: ${mismatches.join(', ')}`,
      );
    }
  }

  return {
    packetObservationCount: packetObservations.size,
    totalInputObservationCount: inputIds.size,
  };
}

async function applyPackets(
  databaseUrl: string,
  dryRun: boolean,
): Promise<{
  readonly ids: readonly string[];
  readonly derivedIds: readonly string[];
  readonly retiredIds: readonly string[];
  readonly verifiedCount: number;
  readonly packetObservationCount: number;
  readonly totalInputObservationCount: number;
}> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  const ids: string[] = [];
  const derivedIds: string[] = [];
  const retiredIds: string[] = [];
  try {
    const observationVerification = await verifyCanonicalObservationInputs(client);
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = '30s'`);
    for (const packet of ALL_PACKETS) {
      assertThemeImpactPacketPublishable(packet);
      const result = await client.query<{ id: string }>(UPSERT_SQL, [
        packet.id,
        packet.questionId,
        packet.themeId,
        packet.title,
        packet.summary,
        [...packet.policyEras],
        JSON.stringify(packet.geography),
        packet.methodStance,
        packet.methodNote,
        JSON.stringify(packet.observations),
        JSON.stringify(packet.derived),
        JSON.stringify(packet.artifacts),
        [...packet.gapStates],
        [...(packet.causalClaimIds ?? [])],
        packet.entityBinding?.entityId ?? null,
        packet.entityBinding?.purpose ?? null,
        packet.status,
        packet.createdAt,
        packet.updatedAt,
      ]);
      ids.push(result.rows[0]!.id);
    }

    for (const { row, packet } of uniqueDerivedRows(ALL_PACKETS)) {
      const result = await client.query<{ id: string }>(UPSERT_DERIVED_SQL, [
        row.derivedId,
        row.methodId,
        '2026-07-23.1',
        [...row.inputObservationIds],
        row.value,
        row.formula,
        ['descriptive only', 'juxtaposition is not causation'],
        row.status,
        packet.updatedAt,
        derivedJurisdictionId(row, packet),
        null,
        row.provenance.source,
        row.provenance.sourceUrl,
        row.provenance.contentHash,
        JSON.stringify({
          unit: row.unit,
          label: row.label ?? row.methodId,
          humanCitation: row.provenance.humanCitation,
          packetIds: ALL_PACKETS.filter((candidate) =>
            candidate.derived.some((value) => value.derivedId === row.derivedId),
          ).map((candidate) => candidate.id),
        }),
      ]);
      derivedIds.push(result.rows[0]!.id);
    }

    for (const retiredId of RETIRED_PACKET_IDS) {
      const result = await client.query<{ id: string }>(
        `UPDATE bb_reference.theme_impact_packets
         SET status = 'review', updated_at = $2::timestamptz
         WHERE id = $1 AND status = 'published'
         RETURNING id`,
        [retiredId, ALL_PACKETS[0]!.updatedAt],
      );
      if (result.rows[0]) retiredIds.push(result.rows[0].id);
    }

    const verification = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM bb_reference.theme_impact_packets
       WHERE status = 'published'
         AND id = ANY($1::text[])`,
      [ids],
    );
    const verifiedCount = verification.rows[0]?.count ?? 0;
    if (verifiedCount !== ALL_PACKETS.length) {
      throw new Error(
        `packet verification expected ${ALL_PACKETS.length}, received ${verifiedCount}`,
      );
    }

    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return {
      ids,
      derivedIds,
      retiredIds,
      verifiedCount,
      ...observationVerification,
    };
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
  const dryRun = !apply;
  const databaseUrl = process.env.DATABASE_URL?.trim();

  const summary = ALL_PACKETS.map((packet) => ({
    id: packet.id,
    question_id: packet.questionId,
    status: packet.status,
    observationCount: packet.observations.length,
    derivedCount: packet.derived.length,
    artifactCount: packet.artifacts.length,
    gap_states: packet.gapStates,
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

  for (const packet of ALL_PACKETS) {
    assertThemeImpactPacketPublishable(packet);
  }

  if (!databaseUrl) {
    if (apply) {
      throw new Error('DATABASE_URL is required when APPLY_THEME_IMPACT_PACKETS=1');
    }
    console.log('Validated packet contracts only; DATABASE_URL is not configured.');
    return;
  }

  const result = await applyPackets(databaseUrl, dryRun);
  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run-rolled-back' : 'applied',
        ...result,
      },
      null,
      2,
    ),
  );
}

await main();
