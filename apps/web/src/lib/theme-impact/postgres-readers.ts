/**
 * Server-side Postgres readers for published theme-impact packets in
 * `bb_reference.theme_impact_packets`.
 */
import {
  parseThemeImpactPacketRow,
  type ThemeImpactPacket,
} from '@repo/domain';
import { queryPostgres } from '../public-data/postgres-client';

type ThemeImpactPacketRow = {
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
  readonly status: string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

function mapRow(row: ThemeImpactPacketRow): ThemeImpactPacket {
  return parseThemeImpactPacketRow({
    ...row,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function listPublishedThemeImpactPacketsByTheme(
  themeId: string,
): Promise<readonly ThemeImpactPacket[]> {
  const rows = await queryPostgres<ThemeImpactPacketRow>(
    `SELECT id, question_id, theme_id, title, summary, policy_eras, geography,
            method_stance, method_note, observations, derived, artifacts, gap_states,
            status, created_at, updated_at
     FROM bb_reference.theme_impact_packets
     WHERE status = 'published' AND theme_id = $1
     ORDER BY question_id`,
    [themeId],
  );
  return rows.map(mapRow);
}

export async function fetchPublishedThemeImpactPacket(
  themeId: string,
  questionId: string,
): Promise<ThemeImpactPacket | undefined> {
  const rows = await queryPostgres<ThemeImpactPacketRow>(
    `SELECT id, question_id, theme_id, title, summary, policy_eras, geography,
            method_stance, method_note, observations, derived, artifacts, gap_states,
            status, created_at, updated_at
     FROM bb_reference.theme_impact_packets
     WHERE status = 'published' AND theme_id = $1 AND question_id = $2
     LIMIT 1`,
    [themeId, questionId],
  );
  const row = rows[0];
  return row ? mapRow(row) : undefined;
}

export async function listPublishedThemeImpactThemeIds(): Promise<readonly string[]> {
  const rows = await queryPostgres<{ readonly theme_id: string }>(
    `SELECT DISTINCT theme_id
     FROM bb_reference.theme_impact_packets
     WHERE status = 'published'
     ORDER BY theme_id`,
  );
  return rows.map((row) => row.theme_id);
}
