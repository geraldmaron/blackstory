import { useEffect, useState } from 'react';
import type { AtlasMode } from '../../../components/shell/CommandBar';
import { EXPLORE_PHONE_MAX_WIDTH } from '../../../lib/map-experience/chrome-padding';

/** Explore's phone layout (explore-column.css): a full-screen map with one bottom sheet. */
export const EXPLORE_PHONE_MEDIA_QUERY = `(max-width: ${EXPLORE_PHONE_MAX_WIDTH}px)`;

/**
 * Explore's chrome state that does not depend on the data: which overlays are open, whether the
 * chrome is hidden, whether the layout is the phone sheet, and the viewport height the sheet's
 * detents are measured against. Server-rendered as the wide layout and corrected after mount.
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
  const [chromeHidden, setChromeHidden] = useState(false);
  const [phone, setPhone] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(900);

  useEffect(() => {
    const query = window.matchMedia(EXPLORE_PHONE_MEDIA_QUERY);
    const sync = () => {
      setPhone(query.matches);
      setViewportHeight(window.innerHeight);
    };
    sync();
    query.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      query.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
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
    chromeHidden,
    setChromeHidden,
    phone,
    viewportHeight,
  } as const;
}
