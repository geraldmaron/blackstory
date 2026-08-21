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
 * The Atlas's chrome-visibility state: which mode it's in, which overlays are open, and which
 * side panels show. Split from the record/lens/camera state because none of it depends on the
 * data — it is purely about what's on screen.
 */
export function usePanelVisibility() {
  /**
   * The Atlas opens in the instrument unless a link asked for the story.
   *
   * Rooms outside the map carry Journey in the bar as `/#journey`, because there is no surface
   * there to toggle. A fragment rather than a query param: `/` normalizes its query at the edge
   * against the explore allowlist, so a param would be stripped before this ran.
   *
   * `#story` is still honoured. It was the fragment this mode shipped under, so it is sitting in
   * bookmarks and in any link already shared; a renamed label is no reason to break them, and a
   * fragment cannot be redirected server-side the way a path can.
   *
   * Applied after mount, not as the initial value: the server has no fragment, so seeding state
   * from it would render `atlas` on the server and the journey on the client and fail hydration.
   * Read once rather than watched, so a reader who then presses Atlas is not pulled back by a
   * fragment still sitting in the address bar.
   */
  const [mode, setMode] = useState<AtlasMode>('atlas');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#journey' || hash === '#story') setMode('story');
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  /**
   * Both panels open is the wide default. On a narrow viewport they would cover the plate between
   * them, so the surface opens on the map and the dock chips bring an instrument in when asked.
   * Server-rendered as the wide layout and corrected after mount: `window` has no width on the
   * server, and guessing one would be a hydration mismatch.
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
      // Narrow opens on the plate with every instrument docked, and the dock is the switcher that
      // brings one in. Widening brings them all back: leaving them docked after a resize strands
      // the reader with an empty map and a row of chips, which is not what they had before the
      // window changed.
      setPanels({
        lens: !isNarrow,
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
