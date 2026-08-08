import { useCallback, useEffect, useState } from 'react';
import type { AtlasMode } from '../../../components/shell/CommandBar';

export type PanelVisibility = { readonly lens: boolean; readonly results: boolean };

/** Below this the instruments cannot all coexist; see `narrowLayout` and the panel CSS. */
const NARROW_BREAKPOINT = 820;

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
  const [panels, setPanels] = useState<PanelVisibility>({ lens: true, results: true });
  const [narrow, setNarrow] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const sync = () => {
      const isNarrow = query.matches;
      setNarrow(isNarrow);
      // Narrow docks both instruments so the plate is the first thing on screen; widening brings
      // them back. Leaving them docked after a resize strands the reader with an empty map and
      // two chips, which is not what they had before the window changed.
      setPanels(isNarrow ? { lens: false, results: false } : { lens: true, results: true });
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /** Narrow shows one instrument at a time. Two sheets on a phone leave no map between them. */
  const showPanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((current) =>
      isNarrowViewport()
        ? { lens: panel === 'lens', results: panel === 'results' }
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
