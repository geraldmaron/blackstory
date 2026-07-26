/**
 * Theme-impact packet lifecycle CLI.
 *
 * Replaces the hardcoded-array apply flow: packets are authored as fixture
 * modules, applied to bb_reference.theme_impact_packets at any lifecycle
 * status, promoted to published behind the full publish gate, and projected
 * into bb_public.release_theme_impact_packets for the active release.
 *
 * Usage (repo root; DATABASE_URL required for every command except validate):
 *   node --conditions development --import tsx packages/ops-data/scripts/theme-packets.ts \
 *     validate packages/ops-data/fixtures/theme-impact/wealth-gap-packets.ts
 *   ... theme-packets.ts apply <fixture.ts ...>        # upsert at declared status
 *   ... theme-packets.ts promote <packetId ...>        # gate + flip to published
 *   ... theme-packets.ts project                       # published -> active release
 *   ... theme-packets.ts audit                         # drift check: release vs reference
 *
 * All write commands run inside a transaction and honor DRY_RUN=1 (rollback).
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  assertThemeImpactPacketMultiDecadeChecklist,
  assertThemeImpactPacketPublishable,
  deriveDefaultMultiDecadeChecklist,
  lookupSourceTier,
  parseThemeImpactPacketRow,
  type SourceTier,
  type ThemeImpactPacket,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const USAGE = 'usage: theme-packets.ts <validate|apply|promote|project|audit> [args...]';

/** Row shape of bb_reference.theme_impact_packets, as parseThemeImpactPacketRow expects. */
type PacketRow = {
  readonly id: string;
  readonly question_id: string;
  readonly theme_id: string;
  readonly title: string;
  readonly summary: string;
  readonly policy_eras: readonly string[];
  readonly geography: unknown;
  readonly method_stance: string;
  readonly method_note: string;
  readonly observations: unknown;
  readonly derived: unknown;
  readonly artifacts: unknown;
  readonly gap_states: readonly string[];
  readonly causal_claim_ids: readonly string[] | null;
  readonly entity_id: string | null;
  readonly binding_purpose: 'map_panel' | 'story' | 'research' | 'mcp' | null;
  readonly status: string;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
};

const PACKET_COLUMNS = `id, question_id, theme_id, title, summary, policy_eras, geography,
  method_stance, method_note, observations, derived, artifacts, gap_states,
  causal_claim_ids, entity_id, binding_purpose, status, created_at, updated_at`;

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
RETURNING id, status;
`;

/**
 * Fixture modules export packet rows in the bb_reference.theme_impact_packets
 * column shape (snake_case) — the same contract the DB and the read path use.
 */
function isPacketRowLike(value: unknown): value is PacketRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { question_id?: unknown }).question_id === 'string' &&
    typeof (value as { theme_id?: unknown }).theme_id === 'string' &&
    Array.isArray((value as { observations?: unknown }).observations)
  );
}

async function loadFixturePackets(paths: readonly string[]): Promise<readonly ThemeImpactPacket[]> {
  if (paths.length === 0) throw new Error('at least one fixture module path is required');
  const packets = new Map<string, ThemeImpactPacket>();
  for (const path of paths) {
    const module: Record<string, unknown> = await import(
      pathToFileURL(resolve(path)).href
    );
    let found = 0;
    for (const exported of Object.values(module)) {
      const candidates = Array.isArray(exported) ? exported : [exported];
      for (const candidate of candidates) {
        if (!isPacketRowLike(candidate)) continue;
        found += 1;
        const packet = parseThemeImpactPacketRow(candidate);
        const prior = packets.get(packet.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(packet)) {
          throw new Error(`packet ${packet.id} defined twice with different content`);
        }
        packets.set(packet.id, packet);
      }
    }
    if (found === 0) {
      throw new Error(
        `${path}: no ThemeImpactPacket exports found (export a packet object or an array of them)`,
      );
    }
  }
  return [...packets.values()];
}

function validatePacketShape(packet: ThemeImpactPacket): void {
  // The loader already round-tripped rows through parseThemeImpactPacketRow;
  // the full gates apply only when a packet declares itself published.
  if (packet.status === 'published') {
    assertThemeImpactPacketPublishable(packet);
    assertThemeImpactPacketMultiDecadeChecklist(packet);
  }
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Offline hash-discipline lint (always on, no DB required): every observation's
 * provenance.contentHash must be a 64-char lowercase hex sha256. This alone
 * catches placeholder hashes — e.g. wealth-gap-packets.ts once carried
 * 'eyJtZXRyaWNJ' (truncated base64) and a literal spine-id string, both of which
 * passed the old shape-only validate and would have shipped fabricated figures.
 */
function lintObservationHashes(packets: readonly ThemeImpactPacket[]): void {
  const problems: string[] = [];
  for (const packet of packets) {
    for (const observation of packet.observations) {
      const hash = observation.provenance.contentHash;
      if (!SHA256_HEX.test(hash)) {
        problems.push(
          `${packet.id} / ${observation.observationId}: contentHash is not 64-char lowercase hex sha256 (got ${JSON.stringify(
            hash.length > 24 ? `${hash.slice(0, 24)}…` : hash,
          )})`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`contentHash format lint failed:\n  ${problems.join('\n  ')}`);
  }
}

/**
 * Source-quality gate (consults the shared tier registry, not a parallel list):
 * every observation's sourceUrl is classified into a trust tier. T4 (untrusted,
 * unclassified) sources are a hard error on published packets and a surfaced
 * warning otherwise, so slop/citation-mill hosts can't quietly back a live
 * figure. Returns the per-tier tally for the validate report.
 */
function gateSourceTiers(packets: readonly ThemeImpactPacket[]): {
  tally: Record<SourceTier, number>;
  warnings: string[];
} {
  const tally: Record<SourceTier, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  const warnings: string[] = [];
  const errors: string[] = [];
  for (const packet of packets) {
    for (const observation of packet.observations) {
      const url = observation.provenance.sourceUrl;
      let tier: SourceTier = 'T4';
      try {
        tier = lookupSourceTier(url).tier;
      } catch {
        tier = 'T4';
      }
      tally[tier] += 1;
      if (tier === 'T4') {
        const message = `${packet.id} / ${observation.observationId}: untrusted (T4) sourceUrl ${JSON.stringify(url)}`;
        if (packet.status === 'published') errors.push(message);
        else warnings.push(message);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`source-tier gate failed (published packets):\n  ${errors.join('\n  ')}`);
  }
  return { tally, warnings };
}

/**
 * Every observation a packet cites must exist verbatim in canonical
 * statistical_observations — at every lifecycle status, not just publish.
 */
async function verifyObservationsAgainstCanonical(
  client: pg.PoolClient,
  packets: readonly ThemeImpactPacket[],
): Promise<number> {
  const allObservations = new Map(
    packets.flatMap((packet) =>
      packet.observations.map((row) => [row.observationId, row] as const),
    ),
  );
  if (allObservations.size === 0) return 0;

  // Spine refs (`spine:<spine_id>:<period>`) verify against the spliced spine
  // view; everything else verifies against canonical statistical_observations.
  const packetObservations = new Map(
    [...allObservations].filter(([id]) => !id.startsWith('spine:')),
  );
  const spineObservations = new Map(
    [...allObservations].filter(([id]) => id.startsWith('spine:')),
  );

  const problems: string[] = [];

  if (spineObservations.size > 0) {
    const spineKeys = [...spineObservations.keys()].map((id) => {
      const [, spineId, period] = id.split(':');
      return { id, spineId: spineId ?? '', period: period ?? '' };
    });
    const spineResult = await client.query<{
      spine_id: string;
      reference_period: string;
      estimate: number;
      source: string;
      source_url: string;
    }>(
      `SELECT spine_id, reference_period, estimate, source, source_url
       FROM bb_reference.spine_observations_v
       WHERE spine_id = ANY($1::text[])`,
      [[...new Set(spineKeys.map((key) => key.spineId))]],
    );
    const spineByKey = new Map(
      spineResult.rows.map((row) => [`${row.spine_id}:${row.reference_period}`, row]),
    );
    for (const { id, spineId, period } of spineKeys) {
      const packetRow = spineObservations.get(id)!;
      const canonical = spineByKey.get(`${spineId}:${period}`);
      if (!canonical) {
        problems.push(`${id}: missing from spine observations`);
        continue;
      }
      const mismatches = [
        canonical.estimate !== packetRow.estimate ? 'estimate' : undefined,
        canonical.reference_period !== packetRow.referencePeriod ? 'referencePeriod' : undefined,
        canonical.source_url !== packetRow.provenance.sourceUrl ? 'sourceUrl' : undefined,
      ].filter((value): value is string => value !== undefined);
      if (mismatches.length > 0) {
        problems.push(`${id}: differs from spine row (${mismatches.join(', ')})`);
      }
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
    [[...packetObservations.keys()]],
  );
  const canonicalById = new Map(result.rows.map((row) => [row.id, row]));

  for (const [id, packetRow] of packetObservations) {
    const canonical = canonicalById.get(id);
    if (!canonical) {
      problems.push(`${id}: missing from canonical observations`);
      continue;
    }
    const mismatches = [
      canonical.metric_id !== packetRow.metricId ? 'metricId' : undefined,
      canonical.estimate !== packetRow.estimate ? 'estimate' : undefined,
      canonical.reference_period !== packetRow.referencePeriod ? 'referencePeriod' : undefined,
      canonical.source !== packetRow.provenance.source ? 'source' : undefined,
      canonical.source_url !== packetRow.provenance.sourceUrl ? 'sourceUrl' : undefined,
      canonical.content_hash !== packetRow.provenance.contentHash ? 'contentHash' : undefined,
    ].filter((value): value is string => value !== undefined);
    if (mismatches.length > 0) {
      problems.push(`${id}: differs from canonical row (${mismatches.join(', ')})`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`observation verification failed:\n  ${problems.join('\n  ')}`);
  }
  return allObservations.size;
}

type DbContext = {
  readonly pool: pg.Pool;
  readonly client: pg.PoolClient;
  readonly dryRun: boolean;
};

async function withDb<T>(run: (ctx: DbContext) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required for this command');
  const dryRun = process.env.DRY_RUN === '1';
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = '60s'`);
    const value = await run({ pool, client, dryRun });
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function commandValidate(paths: readonly string[]): Promise<void> {
  const packets = await loadFixturePackets(paths);
  for (const packet of packets) validatePacketShape(packet);
  // Offline gate: hash-format discipline runs on every validate, DB or not.
  lintObservationHashes(packets);
  // Offline gate: source-quality tiering — T4 hosts fail published packets.
  const { tally: sourceTiers, warnings: sourceTierWarnings } = gateSourceTiers(packets);
  for (const warning of sourceTierWarnings) console.warn(`warning: ${warning}`);

  // DB-binding gate: when DATABASE_URL is present, every observation must match
  // its canonical statistical_observations / spine row exactly (estimate,
  // period, source, contentHash). Skipped only when offline (CI-safe).
  let bound: 'db-verified' | 'offline-skipped' = 'offline-skipped';
  let verifiedObservations = 0;
  if (process.env.DATABASE_URL?.trim()) {
    verifiedObservations = await withDb(({ client }) =>
      verifyObservationsAgainstCanonical(client, packets),
    );
    bound = 'db-verified';
  }

  console.log(
    JSON.stringify(
      {
        command: 'validate',
        ok: true,
        bound,
        verifiedObservations,
        sourceTiers,
        packets: packets.map((packet) => ({
          id: packet.id,
          status: packet.status,
          observations: packet.observations.length,
        })),
      },
      null,
      2,
    ),
  );
}

async function commandApply(paths: readonly string[]): Promise<void> {
  const packets = await loadFixturePackets(paths);
  for (const packet of packets) validatePacketShape(packet);

  const result = await withDb(async ({ client, dryRun }) => {
    const verifiedObservations = await verifyObservationsAgainstCanonical(client, packets);
    const applied: { id: string; status: string }[] = [];
    for (const packet of packets) {
      const row = await client.query<{ id: string; status: string }>(UPSERT_SQL, [
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
      applied.push(row.rows[0]!);
    }
    return { applied, verifiedObservations, dryRun };
  });

  console.log(JSON.stringify({ command: 'apply', ...result }, null, 2));
}

async function commandPromote(packetIds: readonly string[]): Promise<void> {
  if (packetIds.length === 0) throw new Error('at least one packet id is required');

  const result = await withDb(async ({ client, dryRun }) => {
    const rows = await client.query<PacketRow>(
      `SELECT ${PACKET_COLUMNS} FROM bb_reference.theme_impact_packets WHERE id = ANY($1::text[])`,
      [[...packetIds]],
    );
    const foundIds = new Set(rows.rows.map((row) => row.id));
    const missing = packetIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new Error(`packets not found: ${missing.join(', ')}`);

    const packets = rows.rows.map((row) => parseThemeImpactPacketRow(row));
    // Rows round-tripped through the DB carry no checklist; derive the default,
    // exactly as buildThemeImpactPacket does at authoring time.
    const promotable = packets.map((packet) => ({
      ...packet,
      status: 'published' as const,
      multiDecadeChecklist:
        packet.multiDecadeChecklist ?? deriveDefaultMultiDecadeChecklist(packet),
    }));
    for (const packet of promotable) {
      assertThemeImpactPacketPublishable(packet);
      assertThemeImpactPacketMultiDecadeChecklist(packet);
    }
    const verifiedObservations = await verifyObservationsAgainstCanonical(client, promotable);

    const promoted: string[] = [];
    for (const id of packetIds) {
      const updated = await client.query<{ id: string }>(
        `UPDATE bb_reference.theme_impact_packets
         SET status = 'published', updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id],
      );
      promoted.push(updated.rows[0]!.id);
    }
    return { promoted, verifiedObservations, dryRun };
  });

  console.log(JSON.stringify({ command: 'promote', ...result }, null, 2));
}

function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function resolveActiveReleaseId(client: pg.PoolClient): Promise<string> {
  const active = await client.query<{ release_id: string }>(
    `SELECT release_id FROM bb_public.active_release WHERE id = 'active'`,
  );
  const releaseId = active.rows[0]?.release_id;
  if (!releaseId) throw new Error('no active release configured in bb_public.active_release');
  return releaseId;
}

async function commandProject(): Promise<void> {
  const result = await withDb(async ({ client, dryRun }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const rows = await client.query<PacketRow>(
      `SELECT ${PACKET_COLUMNS} FROM bb_reference.theme_impact_packets WHERE status = 'published' ORDER BY id`,
    );

    const projected: string[] = [];
    const unchanged: string[] = [];
    for (const row of rows.rows) {
      const packet = parseThemeImpactPacketRow(row);
      const hash = contentHash(packet);
      const upserted = await client.query<{ packet_id: string; inserted: boolean }>(
        `INSERT INTO bb_public.release_theme_impact_packets (
           release_id, packet_id, theme_id, question_id, payload, content_hash
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (release_id, packet_id) DO UPDATE SET
           theme_id = EXCLUDED.theme_id,
           question_id = EXCLUDED.question_id,
           payload = EXCLUDED.payload,
           content_hash = EXCLUDED.content_hash
         WHERE bb_public.release_theme_impact_packets.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         RETURNING packet_id, (xmax = 0) AS inserted`,
        [releaseId, packet.id, packet.themeId, packet.questionId, JSON.stringify(packet), hash],
      );
      if (upserted.rows[0]) projected.push(packet.id);
      else unchanged.push(packet.id);
    }

    const stale = await client.query<{ packet_id: string }>(
      `DELETE FROM bb_public.release_theme_impact_packets
       WHERE release_id = $1 AND packet_id <> ALL($2::text[])
       RETURNING packet_id`,
      [releaseId, rows.rows.map((row) => row.id)],
    );

    return {
      releaseId,
      projected,
      unchanged,
      removedStale: stale.rows.map((row) => row.packet_id),
      dryRun,
    };
  });

  console.log(JSON.stringify({ command: 'project', ...result }, null, 2));
}

async function commandAudit(): Promise<void> {
  const result = await withDb(async ({ client }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const referenceRows = await client.query<PacketRow>(
      `SELECT ${PACKET_COLUMNS} FROM bb_reference.theme_impact_packets WHERE status = 'published'`,
    );
    const releaseRows = await client.query<{ packet_id: string; content_hash: string }>(
      `SELECT packet_id, content_hash FROM bb_public.release_theme_impact_packets WHERE release_id = $1`,
      [releaseId],
    );
    const releaseHashById = new Map(
      releaseRows.rows.map((row) => [row.packet_id, row.content_hash]),
    );

    const packets: { packet_id: string; state: string }[] = [];
    for (const row of referenceRows.rows) {
      const releaseHash = releaseHashById.get(row.id);
      releaseHashById.delete(row.id);
      if (releaseHash === undefined) {
        packets.push({ packet_id: row.id, state: 'published_not_projected' });
      } else if (releaseHash !== contentHash(parseThemeImpactPacketRow(row))) {
        packets.push({ packet_id: row.id, state: 'drifted_since_projection' });
      } else {
        packets.push({ packet_id: row.id, state: 'ok' });
      }
    }
    for (const packetId of releaseHashById.keys()) {
      packets.push({ packet_id: packetId, state: 'in_release_only' });
    }
    return {
      releaseId,
      packets,
      issues: packets.filter((row) => row.state !== 'ok'),
    };
  });
  console.log(JSON.stringify({ command: 'audit', ...result }, null, 2));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'validate':
      return commandValidate(args);
    case 'apply':
      return commandApply(args);
    case 'promote':
      return commandPromote(args);
    case 'project':
      return commandProject();
    case 'audit':
      return commandAudit();
    default:
      throw new Error(USAGE);
  }
}

await main();
