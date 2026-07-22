/**
 * Theme-impact read routing: live Postgres packets with graceful fixture fallback.
 */
import {
  themeImpactPacketToView,
  type ThemeImpactPacket,
  type ThemeImpactPacketView,
} from '@repo/domain';
import { cache } from 'react';
import {
  getPacketFixture,
  listPacketsForTheme as listFixturePacketsForTheme,
} from '../../components/theme-impact/fixtures';
import type { ThemeImpactPacketFixture } from '../../components/theme-impact/fixtures/types';
import { hasPostgresConnection } from '../public-data/live-policy';
import {
  fetchPublishedThemeImpactPacket,
  listPublishedThemeImpactPacketsByTheme,
} from './postgres-readers';

export type ThemeImpactReadSource = 'live' | 'fixture' | 'mixed';

function fixtureToView(packet: ThemeImpactPacketFixture): ThemeImpactPacketView {
  return {
    ...packet,
    dataSource: 'fixture',
  };
}

function liveToView(packet: ThemeImpactPacket): ThemeImpactPacketView {
  return themeImpactPacketToView(packet, { dataSource: 'live' });
}

function shouldAttemptLiveReads(): boolean {
  if (process.env.PUBLIC_READ_API_DISABLED === '1' || process.env.PUBLIC_READ_API_DISABLED === 'true') {
    return false;
  }
  return hasPostgresConnection();
}

const listLivePacketsByTheme = cache(async (themeId: string) => {
  if (!shouldAttemptLiveReads()) return [] as readonly ThemeImpactPacket[];
  try {
    return await listPublishedThemeImpactPacketsByTheme(themeId);
  } catch {
    return [] as readonly ThemeImpactPacket[];
  }
});

const fetchLivePacket = cache(async (themeId: string, questionId: string) => {
  if (!shouldAttemptLiveReads()) return undefined;
  try {
    return await fetchPublishedThemeImpactPacket(themeId, questionId);
  } catch {
    return undefined;
  }
});

export async function listThemeImpactPacketViews(
  themeId: string,
): Promise<{ readonly packets: readonly ThemeImpactPacketView[]; readonly source: ThemeImpactReadSource }> {
  const fixtures = listFixturePacketsForTheme(themeId).map(fixtureToView);
  const live = await listLivePacketsByTheme(themeId);

  if (live.length === 0) {
    return { packets: fixtures, source: 'fixture' };
  }

  const liveByQuestion = new Map(live.map((packet) => [packet.questionId, liveToView(packet)]));
  const merged: ThemeImpactPacketView[] = [];
  const seen = new Set<string>();

  for (const fixture of fixtures) {
    const fromLive = liveByQuestion.get(fixture.questionId);
    if (fromLive) {
      merged.push(fromLive);
      seen.add(fixture.questionId);
    } else {
      merged.push(fixture);
    }
  }

  for (const packet of live) {
    if (!seen.has(packet.questionId)) {
      merged.push(liveToView(packet));
    }
  }

  merged.sort((a, b) => a.questionId.localeCompare(b.questionId));

  const source: ThemeImpactReadSource =
    seen.size === fixtures.length && live.length >= fixtures.length
      ? 'live'
      : seen.size > 0
        ? 'mixed'
        : 'fixture';

  return { packets: merged, source };
}

export async function resolveThemeImpactPacketView(
  themeId: string,
  questionId: string,
): Promise<ThemeImpactPacketView | undefined> {
  const live = await fetchLivePacket(themeId, questionId);
  if (live) return liveToView(live);
  const fixture = getPacketFixture(themeId, questionId);
  return fixture ? fixtureToView(fixture) : undefined;
}

/** Redlining Q3 pilot packet for story embed / map strip consumers. */
export async function resolveRedliningPilotPacketView(): Promise<ThemeImpactPacketView> {
  const resolved = await resolveThemeImpactPacketView('redlining', 'Q3');
  if (resolved) return resolved;
  const fixtures = listFixturePacketsForTheme('redlining');
  const fallback = fixtures.find((packet) => packet.questionId === 'Q3');
  if (!fallback) {
    throw new Error('redlining Q3 fixture missing');
  }
  return fixtureToView(fallback);
}
