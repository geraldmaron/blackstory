import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { toggleDocumentTheme } from '@repo/ui';
import type { AtlasMode } from '../../../components/shell/CommandBar';
import { useCommandPaletteShortcut } from '../../../components/patterns/command-palette/CommandPalette';
import type { CommandContext } from '../../../components/patterns/command-palette/command-registry';
import type { CameraApi } from '../../../lib/map-experience/camera-moves';
import type { EvidenceFloor } from '../../../lib/map-experience/evidence-grade';
import type { MapKindFamily } from '../../../lib/map-experience/kind-encoding';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { buildShareHref } from '../../../lib/share/deep-link';
import { handleKeyStroke, isEscape, resolveEscape } from '../../../lib/keyboard/bindings';
import { eraBucketFor } from './atlas-feature-helpers';

type UseCommandContextArgs = {
  camera: CameraApi;
  citationFor: (feature: ExploreMapFeature) => string;
  copy: (text: string, message: string) => void;
  decade: number | null;
  evidenceFloor: EvidenceFloor;
  kindFamily: MapKindFamily | null;
  nearMe: () => void;
  resetLens: () => void;
  undoLastAction: () => void;
  selectedFeature: ExploreMapFeature | null;
  selectedId: string | undefined;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  stateCode: string;
  stepRecord: (direction: 1 | -1) => void;
  toggleSave: (feature: ExploreMapFeature) => void;
  setMode: Dispatch<SetStateAction<AtlasMode>>;
  setChromeHidden: Dispatch<SetStateAction<boolean>>;
  paletteOpen: boolean;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  shortcutsOpen: boolean;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  savedOpen: boolean;
  setSavedOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * The command context every keyboard shortcut, the command bar and the palette drive, plus the
 * global keydown listener (escape layering, `?` for shortcuts, and the registry lookup) and the
 * `Cmd-K` shortcut that opens the palette.
 */
export function useCommandContext({
  camera,
  citationFor,
  copy,
  decade,
  evidenceFloor,
  kindFamily,
  nearMe,
  resetLens,
  undoLastAction,
  selectedFeature,
  selectedId,
  setSelectedId,
  stateCode,
  stepRecord,
  toggleSave,
  setMode,
  setChromeHidden,
  paletteOpen,
  setPaletteOpen,
  shortcutsOpen,
  setShortcutsOpen,
  savedOpen,
  setSavedOpen,
}: UseCommandContextArgs) {
  const router = useRouter();

  const commandContext = useMemo<CommandContext>(
    () => ({
      focusSearch: () => setPaletteOpen(true),
      nearMe,
      resetLens,
      undoLastAction,
      camera,
      stepRecord,
      saveRecord: () => {
        if (selectedFeature) toggleSave(selectedFeature);
      },
      copyCitation: () => {
        if (selectedFeature) copy(citationFor(selectedFeature), 'Citation copied.');
      },
      copyShareLink: () => {
        // ADR-017: the link carries the lens, never the live pan/zoom. `buildShareHref` is the
        // only builder allowed to produce it, and its own test proves no viewport key survives.
        const href = buildShareHref(
          {
            ...(selectedId ? { record: selectedId } : {}),
            ...(stateCode ? { state: stateCode } : {}),
            ...(decade !== null ? { era: eraBucketFor(decade) } : {}),
            ...(evidenceFloor !== 'any' ? { grade: evidenceFloor } : {}),
            ...(kindFamily ? { kind: kindFamily } : {}),
          },
          window.location.pathname,
        );
        copy(`${window.location.origin}${href}`, 'Share link copied.');
      },
      closeSheet: () => setSelectedId(undefined),
      setMode,
      openLibrary: () => router.push('/library'),
      togglePlayback: () => {},
      toggleTheme: () => {
        toggleDocumentTheme();
      },
      toggleDensity: () => {
        const root = document.documentElement;
        root.dataset.density = root.dataset.density === 'compact' ? 'comfortable' : 'compact';
      },
      toggleMotion: () => {
        const root = document.documentElement;
        root.dataset.motion = root.dataset.motion === 'calm' ? 'cinematic' : 'calm';
      },
      toggleChrome: () => setChromeHidden((hidden) => !hidden),
    }),
    [
      camera,
      citationFor,
      copy,
      decade,
      evidenceFloor,
      kindFamily,
      nearMe,
      resetLens,
      router,
      undoLastAction,
      selectedFeature,
      selectedId,
      setChromeHidden,
      setMode,
      setPaletteOpen,
      setSelectedId,
      stateCode,
      stepRecord,
      toggleSave,
    ],
  );

  useCommandPaletteShortcut(() => setPaletteOpen(true));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEscape(event)) {
        const layer = resolveEscape({
          palette: paletteOpen,
          overlay: shortcutsOpen || savedOpen,
          spotlight: camera.isSpotlit(),
          sheet: selectedId !== undefined,
        });
        if (!layer) return;
        event.preventDefault();
        if (layer === 'palette') setPaletteOpen(false);
        else if (layer === 'overlay') {
          setShortcutsOpen(false);
          setSavedOpen(false);
        } else if (layer === 'spotlight') camera.spotlight({ trigger: 'reader' });
        else setSelectedId(undefined);
        return;
      }

      if (paletteOpen) return;
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (handleKeyStroke(event, commandContext, { target: event.target })) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    camera,
    commandContext,
    paletteOpen,
    savedOpen,
    selectedId,
    setPaletteOpen,
    setSavedOpen,
    setSelectedId,
    setShortcutsOpen,
    shortcutsOpen,
  ]);

  return commandContext;
}
