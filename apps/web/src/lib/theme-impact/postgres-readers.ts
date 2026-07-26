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

export async function fetchReleaseThemeImpactPacket(
  themeId: string,
  questionId: string,
): Promise<ThemeImpactPacket | undefined> {
  const rows = await queryPostgres<ReleasePacketRow>(
    `SELECT packets.payload
     FROM bb_public.release_theme_impact_packets packets
     ${ACTIVE_RELEASE_JOIN}
     WHERE packets.theme_id = $1 AND packets.question_id = $2
     LIMIT 1`,
    [themeId, questionId],
  );
  const row = rows[0];
  return row ? mapRow(row) : undefined;
}

export async function listReleaseThemeImpactThemeIds(): Promise<readonly string[]> {
  const rows = await queryPostgres<{ readonly theme_id: string }>(
    `SELECT DISTINCT packets.theme_id
     FROM bb_public.release_theme_impact_packets packets
     ${ACTIVE_RELEASE_JOIN}
     ORDER BY packets.theme_id`,
  );
  return rows.map((row) => row.theme_id);
}
