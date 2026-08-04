/**
 * The Atlas — the composition that makes everything P0 to P4 built reachable, mounted over the
 * persistent `MapStage` canvas in place of the v6 chrome it replaced (WP-27).
 *
 * Deliberately does not: own record data (the view model is built on the server and hydrated here
 * unchanged), change status derivation or evidence grading, or consolidate routes (`/` staying a
 * separate surface is WP-25, irreversible, its own approval).
 *
 * The camera reaches the plate through `MapStage.getMap()`, narrow on purpose: preset framing
 * still goes through `flyPreset` (ADR-017), and this handle is only what `camera-moves.ts` needs.
 *
 * This file is the orchestrator (WP-23): render plus wiring. Every piece of state and behaviour
 * lives in a hook under `explore/hooks/` — the lens, the camera, the selection, the saved
 * collection, the story runner, the palette index, the command context.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Notice } from '@repo/ui';
import { focusLandmark } from '../../../lib/keyboard/use-focus-trap';
import { CommandBar } from '../../../components/shell/CommandBar';
import { CommandPalette } from '../../../components/patterns/command-palette/CommandPalette';
import { ShortcutSheet } from '../../../components/patterns/ShortcutSheet';
import { CollectionsDrawer } from '../../../components/patterns/CollectionsDrawer';
import { EmptyState } from '../../../components/patterns/EmptyState';
import { ToastStack, useToasts } from '../../../components/patterns/Toast';
import { AnnotationOverlay } from '../../../components/map-experience/AnnotationOverlay';
import { CameraConsole } from '../../../components/map-experience/CameraConsole';
import { LensPanel, type LensLayerKey } from '../../../components/map-experience/LensPanel';
import { ResultsRail } from '../../../components/map-experience/ResultsRail';
import { RecordSheet } from '../../../components/map-experience/RecordSheet';
import { TimePanel } from '../../../components/map-experience/TimePanel';
import { MIGRATION_CORRIDORS } from '../../../lib/map-experience/migration-corridors';
import { prefersReducedMotion } from '../../../lib/map-experience/camera-presets';
import { StoryMode } from '../../../components/story/StoryMode';
import { clearCollection, unsaveRecord } from '../../../lib/collections/store';
import { useMapStage } from '../MapStage';
import {
  hydrateExploreViewModel,
  type SerializableExploreViewModel,
} from './explore-view-model-wire';
import { eraBucketFor } from './hooks/atlas-feature-helpers';
import { usePanelVisibility } from './hooks/use-panel-visibility';
import { useSavedCollection } from './hooks/use-saved-collection';
import { useLensFilters } from './hooks/use-lens-filters';
import { useMapSync } from './hooks/use-map-sync';
import { useAtlasCamera } from './hooks/use-atlas-camera';
import { useRecordSelection } from './hooks/use-record-selection';
import { usePaletteData } from './hooks/use-palette-data';
import { useReaderActions } from './hooks/use-reader-actions';
import { useCommandContext } from './hooks/use-command-context';
import { useStoryRunner } from './hooks/use-story-runner';
import './atlas.css';

void React;

export type AtlasExperienceProps = {
  readonly initial: SerializableExploreViewModel;
};

export function AtlasExperience({ initial }: AtlasExperienceProps) {
  const stage = useMapStage();
  const view = useMemo(() => hydrateExploreViewModel(initial), [initial]);
  const toasts = useToasts();

  const {
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
  } = usePanelVisibility();

  /**
   * The focus contract for the two panel transitions (design-direction-v9-atlas.md §7).
   *
   * Hiding a panel destroys the button the reader just pressed. Without this, focus falls to
   * `<body>` and their next Tab starts from the top of the document — a keyboard reader loses the
   * instrument *and* their place, for the crime of tidying the screen. So hide moves focus to the
   * dock chip that brings the panel back, and restoring moves it to that panel's header.
   *
   * Run after paint via a queued state flag rather than inside the click handler, because the
   * element being focused does not exist until React has committed the new panel state.
   */
  const [focusAfterPanels, setFocusAfterPanels] = useState<string | null>(null);

  const hidePanel = useCallback(
    (panel: 'lens' | 'results') => {
      setPanels((current) => ({ ...current, [panel]: false }));
      setFocusAfterPanels(`.ds-atlas__dock [data-dock="${panel}"]`);
    },
    [setPanels],
  );

  const restorePanel = useCallback(
    (panel: 'lens' | 'results') => {
      showPanel(panel);
      setFocusAfterPanels(panel === 'lens' ? '.ds-lens__head' : '.ds-results__head');
    },
    [showPanel],
  );

  useEffect(() => {
    if (focusAfterPanels === null) return;
    focusLandmark(document.querySelector(focusAfterPanels));
    setFocusAfterPanels(null);
  }, [focusAfterPanels]);

  // Owned here, not inside the selection hook: the camera's padding needs to know whether the
  // sheet is open without depending on the camera it drives, so the id has to sit above both.
  const [selectedId, setSelectedId] = useState<string | undefined>(initial.viewState.selected);
  const { collection, persist, toggleSave, savedSet } = useSavedCollection(toasts);
  const {
    stateCode,
    setStateCode,
    kindFamily,
    setKindFamily,
    evidenceFloor,
    setEvidenceFloor,
    decade,
    setDecade,
    layers,
    setLayers,
    sort,
    setSort,
    filtered,
    sorted,
    kindCounts,
    presence,
    stateOptions,
    decadeBars,
    resetLens,
  } = useLensFilters(view, toasts);
  useMapSync(stage, view, filtered, layers.pins, layers.satellite, selectedId, stateCode);
  const { camera, readout, spotlight, setSpotlight, runMove } = useAtlasCamera(
    stage,
    panels,
    chromeHidden,
    selectedId !== undefined,
    setLayers,
  );
  const { selectedFeature, selectedIndex, select, stepRecord, sheetRecord } = useRecordSelection(
    stage,
    camera,
    sorted,
    mode,
    selectedId,
    setSelectedId,
  );
  const { copy, citationFor, nearMe } = useReaderActions(toasts, camera);
  const { paletteRecords, destinations, paletteStates, featureById } = usePaletteData(
    view,
    stateOptions,
  );
  const { storyRecord, storyOrder, runChapter } = useStoryRunner(
    view.allFeatures,
    camera,
    decadeBars,
    featureById,
    stage,
    setSelectedId,
    setLayers,
    setSpotlight,
    setDecade,
    mode,
  );
  const commandContext = useCommandContext({
    camera,
    citationFor,
    copy,
    decade,
    evidenceFloor,
    kindFamily,
    nearMe,
    resetLens,
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
  });

  const showLens = panels.lens && !chromeHidden && mode === 'atlas';
  const showResults =
    panels.results && !chromeHidden && mode === 'atlas' && selectedId === undefined;

  return (
    /* `data-key-scope` is what makes the bare camera, time and record keys legal here and nowhere
       else. `handleKeyStroke` walks up from the keystroke's target looking for it, so the Atlas
       marking its own root is the entire scope contract — no route check, no second list. */
    <div
      className="ds-atlas"
      data-key-scope="instrument"
      data-chrome={chromeHidden ? 'hidden' : 'shown'}
      data-mode={mode}
    >
      <CommandBar
        mode={mode}
        onModeChange={setMode}
        onOpenPalette={() => setPaletteOpen(true)}
        recordCount={view.allFeatures.length}
        savedCount={collection.records.length}
        onOpenSaved={() => setSavedOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onToggleTheme={commandContext.toggleTheme}
      />

      {!stage.mapAvailable ? (
        <div className="ds-atlas__notice">
          <Notice tone="warning" title="Map unavailable">
            The map canvas could not start on this device. Every record is still listed and
            searchable in the rail and the palette.
          </Notice>
        </div>
      ) : null}

      <AnnotationOverlay
        map={
          (stage.getMap() as unknown as React.ComponentProps<typeof AnnotationOverlay>['map']) ??
          null
        }
        corridors={MIGRATION_CORRIDORS}
        visible={layers.routes}
      />

      <StoryMode
        active={mode === 'story'}
        onChapter={runChapter}
        onOpenAtlas={() => setMode('atlas')}
        onNearMe={nearMe}
        reducedMotion={prefersReducedMotion()}
        recordSpotlight={storyRecord ?? undefined}
        chapters={storyOrder.chapters}
        factByChapterId={storyOrder.factByChapterId}
      />

      {spotlight ? (
        <div
          className="ds-atlas__spotlight"
          aria-hidden="true"
          style={
            {
              '--ds-spot-x': `${spotlight.x}px`,
              '--ds-spot-y': `${spotlight.y}px`,
              '--ds-spot-radius': `${spotlight.radius}%`,
            } as React.CSSProperties
          }
        />
      ) : null}

      {showLens ? (
        <LensPanel
          matched={filtered.length}
          total={view.allFeatures.length}
          stateOptions={stateOptions}
          state={stateCode}
          onStateChange={setStateCode}
          onNearMe={nearMe}
          kindCounts={kindCounts}
          kindFamily={kindFamily}
          onKindFamilyChange={setKindFamily}
          evidenceFloor={evidenceFloor}
          onEvidenceFloorChange={setEvidenceFloor}
          layers={layers}
          onLayerToggle={(layer: LensLayerKey) =>
            setLayers((current) => ({ ...current, [layer]: !current[layer] }))
          }
          presence={presence}
          onReset={resetLens}
          onHide={() => hidePanel('lens')}
        />
      ) : null}

      {showResults ? (
        <ResultsRail
          features={sorted}
          total={view.allFeatures.length}
          selectedId={selectedId}
          onSelect={select}
          sort={sort}
          onSortChange={setSort}
          savedIds={savedSet}
          onToggleSave={toggleSave}
          onHide={() => hidePanel('results')}
          emptyState={
            <EmptyState
              constraints={{
                ...(evidenceFloor !== 'any' ? { evidenceFloor } : {}),
                ...(decade !== null ? { decade: eraBucketFor(decade) } : {}),
                ...(stateCode ? { state: stateCode } : {}),
                ...(kindFamily ? { kind: kindFamily } : {}),
              }}
              onReset={resetLens}
            />
          }
        />
      ) : null}

      {mode === 'atlas' && !chromeHidden ? (
        <>
          <TimePanel
            bars={decadeBars}
            decade={decade}
            onDecadeChange={setDecade}
            totalRecords={view.allFeatures.length}
          />
          {narrow ? null : (
            <CameraConsole
              onMove={runMove}
              onZoom={(delta) => {
                const map = stage.getMap();
                if (!map) return;
                map.easeTo({ zoom: map.getZoom() + delta, duration: 260 } as never);
              }}
              activeRecord={selectedFeature?.properties ?? null}
              spotlit={camera.isSpotlit()}
            />
          )}
        </>
      ) : null}

      {(!panels.lens || !panels.results) && !chromeHidden ? (
        <div className="ds-atlas__dock">
          {/* `data-dock` is the focus contract's handle: hiding a panel moves focus to the chip
              that brings it back, so the pair has to be addressable from one place. */}
          {!panels.lens ? (
            <button type="button" data-dock="lens" onClick={() => restorePanel('lens')}>
              Lens
            </button>
          ) : null}
          {!panels.results ? (
            <button type="button" data-dock="results" onClick={() => restorePanel('results')}>
              Records
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="ds-atlas__readout" role="status" aria-live="polite">
        {readout}
      </p>

      <RecordSheet
        record={sheetRecord}
        onClose={() => setSelectedId(undefined)}
        {...(selectedIndex >= 0
          ? { position: { index: selectedIndex + 1, total: sorted.length } }
          : {})}
        onStep={stepRecord}
        onFlyToPlace={() => {
          if (selectedFeature) select(selectedFeature);
        }}
        onSave={() => {
          if (selectedFeature) toggleSave(selectedFeature);
        }}
        saved={selectedId ? savedSet.has(selectedId) : false}
        onCite={() => {
          if (selectedFeature) copy(citationFor(selectedFeature), 'Citation copied.');
        }}
        onShare={commandContext.copyShareLink}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        records={paletteRecords}
        states={paletteStates}
        destinations={destinations}
        context={commandContext}
        onOpenRecord={(record, fly) => {
          const feature = featureById(record.id);
          if (feature) {
            select(feature, fly);
            setPaletteOpen(false);
            return;
          }
          // The palette searches the whole index, but only records with a map feature in the
          // current projection can be selected on the Atlas. Without this the click was
          // swallowed: the palette closed and nothing opened, which reads as a broken search.
          // Every record has a page even when it has no pin, so fall through to it.
          setPaletteOpen(false);
          window.location.assign(`/entity/${record.id}`);
        }}
        onJumpToState={(paletteState) => {
          const match = stateOptions.find((option) => option.label === paletteState.name);
          if (match) setStateCode(match.value);
          setPaletteOpen(false);
        }}
      />

      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <CollectionsDrawer
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        collection={collection}
        citations={collection.records.map((record) => {
          const feature = featureById(record.id);
          return feature ? citationFor(feature) : '';
        })}
        onOpenRecord={(record) => {
          const feature = featureById(record.id);
          setSavedOpen(false);
          if (feature) {
            select(feature);
            return;
          }
          // Same as the palette: a saved record whose pin is not in this projection still opens.
          window.location.assign(`/entity/${record.id}`);
        }}
        onRemove={(id) => persist(unsaveRecord(collection, id))}
        onClear={() => persist(clearCollection())}
        onCopyCitations={(text) => copy(text, 'Citations copied.')}
        onCopyGeoJson={(text, unmappable) =>
          copy(
            text,
            unmappable === 0
              ? 'GeoJSON copied.'
              : `GeoJSON copied. ${unmappable} saved ${unmappable === 1 ? 'record has' : 'records have'} no published point.`,
          )
        }
      />

      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}
