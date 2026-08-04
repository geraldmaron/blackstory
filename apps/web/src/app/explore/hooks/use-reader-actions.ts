import { useCallback } from 'react';
import type { UseToasts } from '../../../components/patterns/Toast';
import type { CameraApi } from '../../../lib/map-experience/camera-moves';
import { gradeForConfidence } from '../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { formatCitation } from '../../../lib/citation/format';
import { eraFor } from './atlas-feature-helpers';

/** Clipboard copy, citation formatting, and the "near me" geolocation move. */
export function useReaderActions(toasts: UseToasts, camera: CameraApi) {
  const copy = useCallback(
    (text: string, message: string) => {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => toasts.show({ id: `copy-${Date.now()}`, message }))
        .catch(() =>
          toasts.show({
            id: `copy-fail-${Date.now()}`,
            message: 'Your browser blocked the copy. Select the text and copy it by hand.',
          }),
        );
    },
    [toasts],
  );

  const citationFor = useCallback((feature: ExploreMapFeature): string => {
    const grade = gradeForConfidence(feature.properties.confidenceTier);
    return formatCitation({
      name: feature.properties.displayName,
      place: placeLabelFor(feature),
      era: eraFor(feature),
      grade: grade ?? 'not graded',
      sourceCount: feature.properties.evidenceCount,
      url: `https://blackstory.org${feature.properties.href}`,
      accessed: new Date(),
    });
  }, []);

  const nearMe = useCallback(() => {
    if (!navigator.geolocation) {
      toasts.show({
        id: `near-${Date.now()}`,
        message: 'This browser cannot share a location. Pick a state in the lens instead.',
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        camera.push({
          target: [position.coords.longitude, position.coords.latitude],
          label: 'your location',
        });
      },
      () =>
        toasts.show({
          id: `near-denied-${Date.now()}`,
          message: 'Location was not shared. Pick a state in the lens instead.',
        }),
    );
  }, [camera, toasts]);

  return { copy, citationFor, nearMe } as const;
}
