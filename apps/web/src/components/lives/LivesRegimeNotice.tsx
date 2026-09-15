import React from 'react';
import type { LivesDecadeBundle } from '@repo/domain/statistics/lives';

void React;

const BOUNDARY_COPY = {
  none: null,
  method_note:
    'The income measure changed slightly from the decade before. Read changes between the two with care.',
  different_measure:
    "Class is measured differently than in the decade before, so don't compare the two directly.",
  gap: 'The decade before or after has no census records, so nothing is compared across it.',
} as const;

export type LivesRegimeNoticeProps = {
  readonly decade: LivesDecadeBundle;
};

/** What "class" means in this decade, and anything that limits comparing it with its neighbors. */
export function LivesRegimeNotice({ decade }: LivesRegimeNoticeProps) {
  const boundary = BOUNDARY_COPY[decade.boundaryFromPrevious];
  return (
    <aside className="lives-regime" aria-label={`How the ${decade.label} are measured`}>
      <p className="lives-regime__label">{decade.classLabel}</p>
      <p>{decade.regimeDescription.readerNote}</p>
      {boundary ? <p className="lives-regime__boundary">{boundary}</p> : null}
      {decade.hispanicOriginImputed && decade.regime !== 'no_microdata' ? (
        <p>
          The census did not ask about Hispanic origin until 1970. For this decade it was estimated
          by IPUMS from birthplace, family and, in some states, surnames.
        </p>
      ) : null}
      {decade.comparabilityNote ? (
        <p className="lives-regime__note">{decade.comparabilityNote}</p>
      ) : null}
    </aside>
  );
}
