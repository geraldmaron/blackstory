import { useCallback, useEffect, useState } from 'react';
import type { AtlasMode } from '../../../components/shell/CommandBar';
import {
  COMPACT_MEDIA_QUERY,
  isCompactViewport,
  SINGLE_SIDE_PANEL_MAX_WIDTH,
  SINGLE_SIDE_PANEL_MEDIA_QUERY,
} from '../../../lib/layout/compact-viewport';

/**
 * Which floating instruments are on screen. Three, not two: `decade` (the time panel) joined the
 * pair because the narrow layout switches between all three rather than stacking them.
 */
export type PanelVisibility = {
  readonly lens: boolean;
  readonly results: boolean;
  readonly decade: boolean;
};

/** Below this the instruments cannot all coexist; see `narrowLayout` and the panel CSS. */
// (compact = narrow OR short; see lib/layout/compact-viewport.ts)

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && isCompactViewport(window.innerWidth, window.innerHeight);
}

/** 820–1149px: room for the map plus ONE side panel. Filters and Records take turns. */
function isSingleSidePanelViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    !isNarrowViewport() &&
    window.innerWidth <= SINGLE_SIDE_PANEL_MAX_WIDTH
  );
}

/**
 * Explore's chrome-visibility state: which mode it's in, which overlays are open, and which
 * side panels show. Split from the record/lens/camera state because none of it depends on the
 * data — it is purely about what's on screen.
 */
export function usePanelVisibility() {
  /**
   * Journey lives on the Door (`/`). Legacy `/explore#journey` and `#story` bookmarks
   * redirect there after mount so the fragment still works without a second Journey chrome.
   */
  const [mode, setMode] = useState<AtlasMode>('atlas');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#journey' || hash === '#story') {
      window.location.replace('/');
    }
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  /**
   * All four open is the wide default. On a narrow viewport four panels would cover the plate
   * between them, so only Lens (the filters) stays open; Results and Decade collapse
   * to the dock and the reader brings one in when asked. Landing on Explore with every panel
   * collapsed would leave a map with no visible controls. Lens is the instrument that remains
   * open at every width. Server-rendered as the wide layout and corrected after mount.
   */
  const [panels, setPanels] = useState<PanelVisibility>({
    lens: true,
    results: true,
    decade: true,
  });
  const [narrow, setNarrow] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_MEDIA_QUERY);
    const midQuery = window.matchMedia(SINGLE_SIDE_PANEL_MEDIA_QUERY);
    const sync = () => {
      const isNarrow = query.matches;
      const isMid = !isNarrow && midQuery.matches;
      setNarrow(isNarrow);
      setPanels(() => ({
        // Compact opens map-first: the dock's Filters chip is one tap away, and a sheet covering
        // 40% of a phone on arrival hid the very map the reader came for.
        lens: !isNarrow,
        // Mid widths (tablet portrait) hold one side panel: two left a 140px strip of map.
        results: !isNarrow && !isMid,
        decade: !isNarrow,
      }));
    };
    sync();
    query.addEventListener('change', sync);
    midQuery.addEventListener('change', sync);
    return () => {
      query.removeEventListener('change', sync);
      midQuery.removeEventListener('change', sync);
    };
  }, []);

  /** Narrow shows one instrument at a time. Four panels on a phone leave no map between them. */
  const showPanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((current) =>
      isNarrowViewport()
        ? {
            lens: panel === 'lens',
            results: panel === 'results',
            decade: panel === 'decade',
          }
        : isSingleSidePanelViewport() && (panel === 'lens' || panel === 'results')
          ? {
              ...current,
              lens: panel === 'lens',
              results: panel === 'results',
            }
          : { ...current, [panel]: true },
    );
  }, []);

  return {
    mode,
    setMode,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    savedOpen,
    setSavedOpen,
    panels,
    setPanels,
    narrow,
    chromeHidden,
    setChromeHidden,
    showPanel,
  } as const;
}
