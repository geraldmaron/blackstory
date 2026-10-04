import { useCallback } from 'react';
import type { UseToasts } from '../../../components/patterns/Toast';
import { gradeForConfidence } from '../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { formatCitation } from '../../../lib/citation/format';
import { eraFor } from './atlas-feature-helpers';

/** Clipboard copy and citation formatting. Locating lives in `use-locate-me.ts`. */
export function useReaderActions(toasts: UseToasts) {
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
      // The page's own origin: the site lives at blackstory.app, and a hard-coded host had drifted
      // to a domain this site does not serve.
      url: `${typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL ?? '') : window.location.origin}${feature.properties.href || '/'}`,
      accessed: new Date(),
    });
  }, []);

  return { copy, citationFor } as const;
}
