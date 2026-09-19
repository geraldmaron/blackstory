import React from 'react';
import type { LivesDecadeBundle } from '@repo/domain/statistics/lives';

void React;

const BOUNDARY_COPY = {
  none: null,
  method_note:
    'The income source changed from the decade before, though both describe households. Read changes between them with care.',
  different_measure:
    "Class is measured differently than in the decade before, so don't compare the two directly.",
} as const;

export type LivesRegimeNoticeProps = {
  readonly decade: LivesDecadeBundle;
};

/** What "class" means in this decade, and anything that limits comparing it with the decade before. */
export function LivesRegimeNotice({ decade }: LivesRegimeNoticeProps) {
  const boundary = BOUNDARY_COPY[decade.boundaryFromPrevious];
  return (
    <aside className="lives-regime" aria-label={`How class is measured in the ${decade.label}`}>
      <p className="lives-regime__label">{decade.classLabel}</p>
      <p>{decade.regimeDescription.readerNote}</p>
      {boundary ? <p className="lives-regime__boundary">{boundary}</p> : null}
    </aside>
  );
}
