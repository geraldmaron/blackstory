import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UseToasts } from '../../../components/patterns/Toast';
import {
  saveRecord as addSaved,
  readCollection,
  savedIds as savedIdSet,
  unsaveRecord,
  writeCollection,
  type SavedCollection,
} from '../../../lib/collections/store';
import { gradeForConfidence } from '../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { eraFor } from './atlas-feature-helpers';

/** The reader's saved-records collection: persistence, the toggle action, and the id index. */
export function useSavedCollection(toasts: UseToasts) {
  const [collection, setCollection] = useState<SavedCollection>(() => readCollection(null));

  // Read after mount, never during render: `localStorage` does not exist on the server, and a
  // first client render that disagrees with the server HTML is a hydration mismatch.
  useEffect(() => {
    setCollection(readCollection(globalThis.localStorage));
  }, []);

  const persist = useCallback((next: SavedCollection) => {
    setCollection(next);
    writeCollection(globalThis.localStorage, next);
  }, []);

  const toggleSave = useCallback(
    (feature: ExploreMapFeature) => {
      const id = feature.properties.entityId;
      const wasSaved = collection.records.some((record) => record.id === id);
      const [lng, lat] = feature.geometry.coordinates;
      const next = wasSaved
        ? unsaveRecord(collection, id)
        : addSaved(collection, {
            id,
            name: feature.properties.displayName,
            kind: feature.properties.kind,
            place: placeLabelFor(feature),
            era: eraFor(feature),
            grade: gradeForConfidence(feature.properties.confidenceTier),
            href: feature.properties.href || '/',
            lng,
            lat,
            savedAt: new Date().toISOString(),
          });
      persist(next);
      toasts.show({
        id: `save-${id}-${Date.now()}`,
        message: wasSaved ? 'Removed from saved.' : 'Saved.',
        action: { label: 'Undo', run: () => persist(collection) },
      });
    },
    [collection, persist, toasts],
  );

  const savedSet = useMemo(() => savedIdSet(collection), [collection]);

  return { collection, persist, toggleSave, savedSet } as const;
}
