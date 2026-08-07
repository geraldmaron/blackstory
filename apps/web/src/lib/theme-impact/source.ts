/**
 * Theme-impact read routing: active-release Postgres packets only. There is no
 * checked-in content fallback; when the release read path is unavailable the
 * caller receives an explicit `unavailable` source and renders a friendly
 * degraded state instead of stale substitute content.
 */
import {
  THEME_IMPACT_THEME_IDS,
  themeImpactPacketToView,
  type ThemeImpactPacket,
  type ThemeImpactPacketView,
} from '@repo/domain';
import { cache } from 'react';
import { hasPostgresConnection } from '../public-data/live-policy';
import { THEME_CHAPTER_SLUGS } from '../redirects/theme-alias-table.mjs';
import { getThemeCatalogEntry } from './catalog';
import { listReleaseThemeImpactPacketsByTheme } from './postgres-readers';

export type ThemeImpactReadSource = 'live' | 'unavailable';

function liveToView(packet: ThemeImpactPacket): ThemeImpactPacketView {
  return themeImpactPacketToView(packet, { dataSource: 'live' });
}

function shouldAttemptLiveReads(): boolean {
  return hasPostgresConnection();
}

function logReadFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[theme-impact] ${context} failed; rendering unavailable state: ${message}`);
}

const listLivePacketsByTheme = cache(
  async (
    themeId: string,
  ): Promise<{
    readonly packets: readonly ThemeImpactPacket[];
    readonly source: ThemeImpactReadSource;
  }> => {
    if (!shouldAttemptLiveReads()) return { packets: [], source: 'unavailable' };
    try {
      return { packets: await listReleaseThemeImpactPacketsByTheme(themeId), source: 'live' };
    } catch (error) {
      logReadFailure(`listReleaseThemeImpactPacketsByTheme(${themeId})`, error);
      return { packets: [], source: 'unavailable' };
    }
  },
);

export async function listThemeImpactPacketViews(themeId: string): Promise<{
  readonly packets: readonly ThemeImpactPacketView[];
  readonly source: ThemeImpactReadSource;
}> {
  const { packets, source } = await listLivePacketsByTheme(themeId);
  return { packets: packets.map(liveToView), source };
}

/* -------------------------------------------------------------------------------------------- *
 * Entity cross-references: resolve every published surface a given entityId appears on.
 * With the legacy /stories + /themes routes retired (repo-dx4n) and release_stories dropped
 * (repo-8dj0), the only remaining surface is theme-impact packets bound via
 * `entityBinding.entityId`, rendered on /chapters. Read-only composition over the existing
 * `listThemeImpactPacketViews` reader — no new live reads.
 * -------------------------------------------------------------------------------------------- */

export type EntityCrossReferenceSurface = {
  readonly kind: 'theme_packet';
  readonly themeId: string;
  readonly themeTitle: string;
  readonly questionId: string;
  readonly packetLabel: string;
};

/**
 * Resolve every surface `entityId` appears on. `deps` is test-only dependency injection
 * (defaults to the real readers); production callers should never pass it.
 */
export async function resolveEntityCrossReferences(
  entityId: string,
  deps?: {
    readonly listPackets?: typeof listThemeImpactPacketViews;
    readonly themeIds?: readonly string[];
    readonly getThemeTitle?: (themeId: string) => string | undefined;
  },
): Promise<readonly EntityCrossReferenceSurface[]> {
  const listPackets = deps?.listPackets ?? listThemeImpactPacketViews;
  const themeIds = deps?.themeIds ?? THEME_IMPACT_THEME_IDS;
  const getThemeTitle =
    deps?.getThemeTitle ?? ((themeId: string) => getThemeCatalogEntry(themeId)?.title);

  const surfaces: EntityCrossReferenceSurface[] = [];

  for (const themeId of themeIds) {
    const themeTitle = getThemeTitle(themeId);
    if (!themeTitle) continue;
    const { packets } = await listPackets(themeId);
    for (const packet of packets) {
      if (packet.entityBinding?.entityId !== entityId) continue;
      surfaces.push({
        kind: 'theme_packet',
        themeId,
        themeTitle,
        questionId: packet.questionId,
        packetLabel: packet.question,
      });
    }
  }

  return surfaces;
}

/**
 * Themes absent from the table have no chapter yet (repo-8602) and fall back to the chapters
 * index — the same place the `/themes/:path*` catch-all would land them, without the 308 hop.
 * The table itself lives in `lib/redirects/theme-alias-table.mjs`, which `next.config.mjs` also
 * generates its `/themes` rules from, so an in-app href and its redirect cannot disagree.
 */
function themeHref(themeId: string): string {
  const slug = THEME_CHAPTER_SLUGS[themeId];
  return slug === undefined ? '/stories' : `/stories/${slug}`;
}

/** Build an in-app href for a resolved cross-reference surface. Never returns a dead link. */
export function entityCrossReferenceHref(surface: EntityCrossReferenceSurface): string {
  return themeHref(surface.themeId);
}

/** Human label for a resolved cross-reference surface, used in exit-rail/appears-in copy. */
export function entityCrossReferenceLabel(surface: EntityCrossReferenceSurface): string {
  return `${surface.themeTitle}: ${surface.packetLabel}`;
}
