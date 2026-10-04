import { useCallback, useEffect, useState } from 'react';
import type { AtlasMode } from '../../../components/shell/CommandBar';
import {
  COMPACT_MEDIA_QUERY,
  isCompactViewport,
  SINGLE_SIDE_PANEL_MAX_WIDTH,
  SINGLE_SIDE_PANEL_MEDIA_QUERY,
} from '../../../lib/layout/compact-viewport';

/**
 * Which floating instruments are on screen. Four, not two: `decade` (the time panel) and `camera`
 * (the camera console) joined the pair because the narrow layout switches between all four rather
 * than stacking them — at 390px the console sat inside the results sheet's band and the readout
 * shared the dock's offset.
 */
export type PanelVisibility = {
  readonly lens: boolean;
  readonly results: boolean;
  readonly decade: boolean;
  readonly camera: boolean;
};

/** Below this the instruments cannot all coexist; see `narrowLayout` and the panel CSS. */
// (compact = narrow OR short; see lib/layout/compact-viewport.ts)

/**
 * Above this the record sheet and the results rail both fit, so opening a record does not hide
 * the list it came from: 300 (lens) + 430 (sheet) + 344 (rail) + gutters. Kept in step with the
 * `min-width: 1150px` rule in `record-sheet.css`.
 */
const BOTH_COLUMNS_BREAKPOINT = 1150;

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
   * between them, so only Lens (the filters) stays open; Results, Decade and Camera collapse
   * to the dock and the reader brings one in when asked. Landing on Explore with every panel
   * collapsed would leave a map with no visible controls. Lens is the instrument that remains
   * open at every width. Server-rendered as the wide layout and corrected after mount.
   */
  const [panels, setPanels] = useState<PanelVisibility>({
    lens: true,
    results: true,
    decade: true,
    // Camera console stays behind an explicit restore; landing with every copper instrument
    // open made Explore feel like a second cockpit (plan.md decision 3).
    camera: false,
  });
  const [narrow, setNarrow] = useState(false);
  const [bothColumns, setBothColumns] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_MEDIA_QUERY);
    const wideQuery = window.matchMedia(`(min-width: ${BOTH_COLUMNS_BREAKPOINT}px)`);
    const midQuery = window.matchMedia(SINGLE_SIDE_PANEL_MEDIA_QUERY);
    const sync = () => {
      const isNarrow = query.matches;
      const isMid = !isNarrow && midQuery.matches;
      setNarrow(isNarrow);
      setBothColumns(wideQuery.matches);
      setPanels((current) => ({
        // Compact opens map-first: the dock's Filters chip is one tap away, and a sheet covering
        // 40% of a phone on arrival hid the very map the reader came for.
        lens: !isNarrow,
        // Mid widths (tablet portrait) hold one side panel: two left a 140px strip of map.
        results: !isNarrow && !isMid,
        decade: !isNarrow,
        // Preserve an explicit reader open; otherwise stay closed at rest.
        camera: isNarrow ? false : current.camera,
      }));
    };
    sync();
    query.addEventListener('change', sync);
    wideQuery.addEventListener('change', sync);
    midQuery.addEventListener('change', sync);
    return () => {
      query.removeEventListener('change', sync);
      wideQuery.removeEventListener('change', sync);
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
            camera: panel === 'camera',
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
    bothColumns,
    chromeHidden,
    setChromeHidden,
    showPanel,
  } as const;
}
