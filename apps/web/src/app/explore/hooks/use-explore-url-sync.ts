/**
 * Keep the Atlas address bar in sync with live Lens narrowing (v10 DiscoveryState).
 *
 * Uses `history.replaceState` so changing filters does not remount the map. Viewport
 * (lat/lng/zoom) stays out of the bar (ADR-017). Panel chrome stays out too.
 */
'use client';

import { useEffect, useRef } from 'react';
import { DEFAULT_EXPLORE_FILTERS } from '../../../lib/map-experience/filters';
import {
  buildExploreHref,
  defaultExploreOverlayState,
  type ExploreLayerMode,
  type ExploreViewState,
} from '../../../lib/map-experience/url-state';
import type { EvidenceFloor } from '../../../lib/map-experience/evidence-grade';
import type { MapKindFamily } from '../../../lib/map-experience/kind-encoding';

export type ExploreUrlSyncLens = {
  readonly stateCode: string;
  readonly kindFamily: MapKindFamily | null;
  readonly evidenceFloor: EvidenceFloor;
  readonly topicId: string | null;
  readonly status: string | null;
  readonly layerMode: ExploreLayerMode;
  readonly satellite: boolean;
  readonly selectedId: string | undefined;
};

/**
 * Build the shareable Explore href for the current Lens without camera or panel chrome.
 * Pure so tests can assert floor/state/kind round-trip without a browser.
 */
export function exploreHrefFromLens(base: ExploreViewState, lens: ExploreUrlSyncLens): string {
  const next: ExploreViewState = {
    filters: {
      ...DEFAULT_EXPLORE_FILTERS,
      kind: lens.kindFamily ?? DEFAULT_EXPLORE_FILTERS.kind,
      theme: lens.topicId ?? DEFAULT_EXPLORE_FILTERS.theme,
      status: lens.status ?? DEFAULT_EXPLORE_FILTERS.status,
      // Keep exact confidence / tone / era from the URL seed when Lens does not own them.
      tone: base.filters.tone,
      era: base.filters.era,
      confidence: base.filters.confidence,
    },
    ...defaultExploreOverlayState(),
    layerMode: lens.layerMode,
    sat: lens.satellite,
    group: base.group,
    lines: base.lines,
    ...(lens.stateCode ? { state: lens.stateCode } : {}),
    ...(lens.evidenceFloor === 'A' || lens.evidenceFloor === 'B' || lens.evidenceFloor === 'C'
      ? { floor: lens.evidenceFloor }
      : {}),
    ...(lens.selectedId ? { selected: lens.selectedId } : {}),
    ...(base.popGeo ? { popGeo: base.popGeo } : {}),
    ...(base.popDecade ? { popDecade: base.popDecade } : {}),
    ...(base.popFrom ? { popFrom: base.popFrom } : {}),
    ...(base.popTo ? { popTo: base.popTo } : {}),
    ...(base.decade ? { decade: base.decade } : {}),
    ...(base.edge ? { edge: base.edge } : {}),
    ...(base.radius ? { radius: base.radius } : {}),
    ...(base.near ? { near: base.near } : {}),
  };
  return buildExploreHref(next);
}

export function useExploreUrlSync(base: ExploreViewState, lens: ExploreUrlSyncLens): void {
  const lastPushed = useRef<string | null>(null);
  const href = exploreHrefFromLens(base, lens);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const live = `${window.location.pathname}${window.location.search}`;
    if (live === href || lastPushed.current === href) return;
    window.history.replaceState(window.history.state, '', href);
    lastPushed.current = href;
  }, [href]);
}
