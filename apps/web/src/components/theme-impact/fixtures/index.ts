/**
 * Fixture registry and lookup helpers for theme-impact public pages.
 */

import { DRUG_POLICY_PACKET_FIXTURES } from './packets/drug-policy-state';
import { REDLINING_PACKET_FIXTURES } from './packets/redlining';
import { THEME_IMPACT_CATALOG, getThemeCatalogEntry, listAvailableThemeIds } from './theme-catalog';
import type { ThemeImpactCatalogEntry, ThemeImpactPacketFixture } from './types';

export type { ThemeImpactCatalogEntry, ThemeImpactPacketFixture } from './types';
export { THEME_IMPACT_CATALOG, getThemeCatalogEntry, listAvailableThemeIds };

const ALL_PACKETS: readonly ThemeImpactPacketFixture[] = [
  ...REDLINING_PACKET_FIXTURES,
  ...DRUG_POLICY_PACKET_FIXTURES,
];

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
