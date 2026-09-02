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
import { createReleaseScopedCache } from '../public-data/release-scoped-cache';
import { getPublicActiveReleaseMeta } from '../public-data/source';
import { THEME_CHAPTER_SLUGS } from '../redirects/theme-alias-table.mjs';
import { getThemeCatalogEntry } from './catalog';
import { listReleaseThemeImpactPackets } from './postgres-readers';

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

const releasePacketsCache = createReleaseScopedCache<readonly ThemeImpactPacket[]>({
  kind: 'release-theme-impact-packets-v1',
});

/**
 * Every packet in the active release (~13 rows, ~107KB), read once per release-scoped cache
 * window and shared across requests. The by-theme and by-id readers below are filters over
 * this list. Before this, `resolveEntityCrossReferences` issued one by-theme query per theme
 * on every entity page render — nine queries a page, 515k calls between 2026-07-20 and
 * 2026-09-02. Throws on read failure; the exported readers own the degraded state.
 */
const listReleasePacketsCached = cache(async (): Promise<readonly ThemeImpactPacket[]> => {
  const release = await getPublicActiveReleaseMeta();
  if (!release) return listReleaseThemeImpactPackets();
  return (await releasePacketsCache.get(release, listReleaseThemeImpactPackets)) ?? [];
});

/** Pure filter, exported for tests: packets of one theme, in the reader's stable order. */
export function packetsForTheme(
  packets: readonly ThemeImpactPacket[],
  themeId: string,
): readonly ThemeImpactPacket[] {
  return packets.filter((packet) => packet.themeId === themeId);
}

/** Pure filter, exported for tests: packets whose id is in `ids`, in the reader's order. */
export function packetsWithIds(
  packets: readonly ThemeImpactPacket[],
  ids: readonly string[],
): readonly ThemeImpactPacket[] {
  const wanted = new Set(ids);
  return packets.filter((packet) => wanted.has(packet.id));
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
      return {
        packets: packetsForTheme(await listReleasePacketsCached(), themeId),
        source: 'live',
      };
    } catch (error) {
      logReadFailure(`listReleaseThemeImpactPackets(${themeId})`, error);
      return { packets: [], source: 'unavailable' };
    }
  },
);

/**
 * Packets by id, for article data blocks. Throws on read failure so the article reader can
 * render its own unavailable state (an article with silently missing data blocks would be
 * a falsehood, not a degraded page).
 */
export async function listThemeImpactPacketsByIds(
  ids: readonly string[],
): Promise<readonly ThemeImpactPacket[]> {
  if (ids.length === 0) return [];
  return packetsWithIds(await listReleasePacketsCached(), ids);
}

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
