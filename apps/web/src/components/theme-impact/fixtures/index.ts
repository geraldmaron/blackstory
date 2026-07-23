/**
 * Fixture registry and lookup helpers for theme-impact public pages.
 */

import {
  RESEARCHED_THEME_IMPACT_PACKETS,
  themeImpactPacketToView,
} from '@repo/domain';
import { THEME_IMPACT_CATALOG, getThemeCatalogEntry, listAvailableThemeIds } from './theme-catalog';
import type { ThemeImpactCatalogEntry, ThemeImpactPacketFixture } from './types';

export type { ThemeImpactCatalogEntry, ThemeImpactPacketFixture } from './types';
export { THEME_IMPACT_CATALOG, getThemeCatalogEntry, listAvailableThemeIds };

const ALL_PACKETS: readonly ThemeImpactPacketFixture[] =
  RESEARCHED_THEME_IMPACT_PACKETS.map((packet) =>
    themeImpactPacketToView(packet, { dataSource: 'fixture' }),
  );

export function listPacketsForTheme(themeId: string): readonly ThemeImpactPacketFixture[] {
  return ALL_PACKETS.filter((packet) => packet.themeId === themeId);
}

export function getPacketFixture(
  themeId: string,
  questionId: string,
): ThemeImpactPacketFixture | undefined {
  return ALL_PACKETS.find(
    (packet) => packet.themeId === themeId && packet.questionId === questionId,
  );
}

export function listP0Themes(): readonly ThemeImpactCatalogEntry[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.priority === 'P0');
}

export function listP1Themes(): readonly ThemeImpactCatalogEntry[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.priority === 'P1');
}
