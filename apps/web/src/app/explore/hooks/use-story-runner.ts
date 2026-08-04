import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { AtlasMode } from '../../../components/shell/CommandBar';
import type { LensLayers } from '../../../components/map-experience/LensPanel';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { CameraApi } from '../../../lib/map-experience/camera-moves';
import { sweep, type SweepHandle } from '../../../lib/map-experience/decade-transition';
import { prefersReducedMotion } from '../../../lib/map-experience/camera-presets';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import type { DecadeBar } from '../../../lib/map-experience/decade-density';
import type { StoryChapter } from '../../../lib/story/chapters';
import {
  pickStoryRecord,
  type StoryRecordSpotlight,
} from '../../../lib/story/pick-story-record';
import { pickStoryChapters } from '../../../lib/story/pick-story-chapters';

/**
 * Runs a chapter's beats: camera, spotlight, corridors, decade sweep, and the one record chapter
 * 2 is about (design-direction-v9-atlas.md §6). Story mode was a toggle that hid the instruments
 * and put nothing in their place — `StoryMode.tsx` and `chapters.ts` both existed and neither had
 * a caller.
 */
export function useStoryRunner(
  allFeatures: readonly ExploreMapFeature[],
  camera: CameraApi,
  decadeBars: readonly DecadeBar[],
  featureById: (id: string) => ExploreMapFeature | null,
  stage: MapStageHandle,
  setSelectedId: Dispatch<SetStateAction<string | undefined>>,
  setLayers: Dispatch<SetStateAction<LensLayers>>,
  setSpotlight: Dispatch<SetStateAction<{ x: number; y: number; radius: number } | null>>,
  setDecade: Dispatch<SetStateAction<number | null>>,
  mode: AtlasMode,
) {
  /**
   * The running decade sweep, if a chapter asked for one. Held in a ref rather than state because
   * the next chapter has to cancel it during its own handler, and a state read there would see the
   * previous render's value and leave two sweeps stepping the histogram against each other.
   */
  const sweepRef = useRef<SweepHandle | null>(null);

  const stopSweep = useCallback(() => {
    sweepRef.current?.cancel();
    sweepRef.current = null;
  }, []);

  /**
   * The record chapter 2 shows and the fact chapter 3 shows, drawn once per mount rather than per
   * render. Re-rolling on every render would change the card under the reader mid-sentence, and
   * re-rolling on every chapter change would mean scrolling back up produced a different archive.
   *
   * `Math.random` is read here, in an effect-free initialiser, rather than inside the pure pickers,
   * so both remain reproducible in a test.
   */
  const [storyRoll] = useState(() => ({
    record: Math.random(),
    fact: Math.random(),
    order: Math.random(),
  }));
  const storyRecord = useMemo<StoryRecordSpotlight | null>(
    () => pickStoryRecord(allFeatures, storyRoll.record),
    [storyRoll.record, allFeatures],
  );
  /**
   * Which chapters run this visit and which cited fact each rotating chapter carries. Drawn from
   * one roll at mount for the same reason as the record above: the renderer, the intersection
   * observer and `runChapter` all have to agree, and scrolling back up must not re-roll the story
   * under the reader.
   */
  const storyOrder = useMemo(() => pickStoryChapters(storyRoll.order), [storyRoll.order]);

  const runChapter = useCallback(
    (chapter: StoryChapter) => {
      stopSweep();
      camera.cancel();

      const focus =
        chapter.focusRandomRecord && storyRecord ? featureById(storyRecord.entityId) : null;
      setSelectedId(focus?.properties.entityId);

      // A rotating fact names its own geography. Without this the plate would keep whatever the
      // previous chapter framed while the card talked about somewhere else entirely. Read per
      // chapter, since a visit can run two context chapters carrying two different facts.
      const chapterFact = chapter.rotatingFact ? storyOrder.factByChapterId[chapter.id] : undefined;
      const factCamera = chapterFact
        ? { ...chapterFact.camera, place: chapterFact.placeLabel }
        : null;

      if (focus) {
        const [lng, lat] = focus.geometry.coordinates;
        camera.flyToRecord(
          { center: [lng, lat], place: placeLabelFor(focus) },
          { trigger: 'ambient' },
        );
      } else if (factCamera) {
        camera.flyToRecord(
          { center: [factCamera.center[0], factCamera.center[1]], place: factCamera.place },
          { trigger: 'ambient' },
        );
      } else {
        stage.getMap()?.flyTo({
          center: chapter.camera.center,
          zoom: chapter.camera.zoom,
          pitch: chapter.camera.pitch,
          bearing: chapter.camera.bearing,
          duration: prefersReducedMotion() ? 0 : 1600,
        } as never);
      }

      setLayers((current) => ({ ...current, routes: chapter.routes === true }));

      if (chapter.spotlightRadiusPercent !== undefined) {
        camera.spotlight({
          center: chapter.camera.center,
          radiusPercent: chapter.spotlightRadiusPercent,
          trigger: 'ambient',
        });
      } else {
        setSpotlight(null);
      }

      if (chapter.sweep && decadeBars.length > 0) {
        const first = decadeBars[0];
        const last = decadeBars[decadeBars.length - 1];
        if (first && last) {
          sweepRef.current = sweep({
            from: first.decade,
            to: last.decade,
            onDecade: setDecade,
            // The sweep ends on the last decade, which would leave the plate filtered to it. All
            // time is what the chapter is arguing for, so the histogram returns there.
            onDone: () => setDecade(null),
            reducedMotion: prefersReducedMotion(),
          });
        }
      } else {
        setDecade(null);
      }
    },
    [
      camera,
      decadeBars,
      featureById,
      setDecade,
      setLayers,
      setSelectedId,
      setSpotlight,
      stage,
      stopSweep,
      storyOrder,
      storyRecord,
    ],
  );

  /**
   * Leaving the story must not strand its beats on the Atlas. A spotlight mask, a corridor layer or
   * a stepping histogram left running would read as the map having broken, not as the story having
   * ended.
   */
  useEffect(() => {
    if (mode === 'story') return;
    stopSweep();
    setSpotlight(null);
    // The corridor chapter turns the routes layer on. Left on, it draws six arcs and their labels
    // across an Atlas the reader never asked to annotate, and the lens toggle reads as already-on.
    setLayers((current) => (current.routes ? { ...current, routes: false } : current));
  }, [mode, setLayers, setSpotlight, stopSweep]);

  useEffect(() => stopSweep, [stopSweep]);

  return { storyRecord, storyOrder, runChapter } as const;
}
