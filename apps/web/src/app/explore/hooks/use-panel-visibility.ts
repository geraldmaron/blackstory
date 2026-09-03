import { useCallback, useEffect, useState } from 'react';
import type { AtlasMode } from '../../../components/shell/CommandBar';

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
const NARROW_BREAKPOINT = 820;

/**
 * Above this the record sheet and the results rail both fit, so opening a record no longer hides
 * the list it came from: 300 (lens) + 430 (sheet) + 344 (rail) + gutters. Kept in step with the
 * `min-width: 1150px` rule in `record-sheet.css`.
 */
const BOTH_COLUMNS_BREAKPOINT = 1150;

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT;
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
   * collapsed read as "just a map, no controls" (repo report, 2026-09-02) — Lens is the one
   * panel a reader expects the instrument to open on. Server-rendered as the wide layout and
   * corrected after mount.
   */
  const [panels, setPanels] = useState<PanelVisibility>({
    lens: true,
    results: true,
    decade: true,
    camera: true,
  });
  const [narrow, setNarrow] = useState(false);
  const [bothColumns, setBothColumns] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const wideQuery = window.matchMedia(`(min-width: ${BOTH_COLUMNS_BREAKPOINT}px)`);
    const sync = () => {
      const isNarrow = query.matches;
      setNarrow(isNarrow);
      setBothColumns(wideQuery.matches);
      setPanels({
        lens: true,
        results: !isNarrow,
        decade: !isNarrow,
        camera: !isNarrow,
      });
    };
    sync();
    query.addEventListener('change', sync);
    wideQuery.addEventListener('change', sync);
    return () => {
      query.removeEventListener('change', sync);
      wideQuery.removeEventListener('change', sync);
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
