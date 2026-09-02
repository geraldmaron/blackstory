/**
 * Server-side Postgres readers for theme-impact packets in the active release
 * (`bb_public.release_theme_impact_packets`). The payload column carries the
 * full packet document frozen at projection time by the ops
 * `theme-packets.ts project` step; the envelope is validated here and the rest
 * of the document is trusted as the projection pipeline's output.
 */
import type { ThemeImpactPacket } from '@repo/domain';
import { publicThemeImpactPacketProjectionSchema } from '@repo/schemas';
import { queryPostgres } from '../public-data/postgres-client';

const ACTIVE_RELEASE_JOIN = `
  JOIN bb_public.active_release active
    ON active.id = 'active' AND active.release_id = packets.release_id`;

type ReleasePacketRow = {
  readonly payload: unknown;
};

function mapRow(row: ReleasePacketRow): ThemeImpactPacket {
  publicThemeImpactPacketProjectionSchema.parse(row.payload);
  return row.payload as ThemeImpactPacket;
}

/**
 * Every packet in the active release, in a stable order. The whole table is ~13 rows / ~107KB,
 * so the by-theme and by-id readers in `source.ts` are filters over this one cached read rather
 * than their own queries (they used to run once per theme per entity page: 9 queries a render).
 */
export async function listReleaseThemeImpactPackets(): Promise<readonly ThemeImpactPacket[]> {
  const rows = await queryPostgres<ReleasePacketRow>(
    `SELECT packets.payload
     FROM bb_public.release_theme_impact_packets packets
     ${ACTIVE_RELEASE_JOIN}
     ORDER BY packets.theme_id, packets.question_id`,
  );
  return rows.map(mapRow);
}

export async function listReleaseThemeImpactPacketsByTheme(
  themeId: string,
): Promise<readonly ThemeImpactPacket[]> {
  const rows = await queryPostgres<ReleasePacketRow>(
    `SELECT packets.payload
     FROM bb_public.release_theme_impact_packets packets
     ${ACTIVE_RELEASE_JOIN}
     WHERE packets.theme_id = $1
     ORDER BY packets.question_id`,
    [themeId],
  );
  return rows.map(mapRow);
}

export async function listReleaseThemeImpactPacketsByIds(
  ids: readonly string[],
): Promise<readonly ThemeImpactPacket[]> {
  if (ids.length === 0) return [];
  const rows = await queryPostgres<ReleasePacketRow>(
    `SELECT packets.payload
     FROM bb_public.release_theme_impact_packets packets
     ${ACTIVE_RELEASE_JOIN}
     WHERE packets.packet_id = ANY($1::text[])`,
    [[...ids]],
  );
  return rows.map(mapRow);
}
