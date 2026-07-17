/**
 * Shared renderer for ONE disclaimer-registry entry (BB-095 AC3).
 *
 * This is the single rendering path disclaimer copy is meant to go through — the registry itself
 * (`DISCLAIMER_REGISTRY` / `getDisclaimer`) lives in `packages/domain/src/disclaimers.ts`. Never
 * hand-write a disclaimer sentence inline elsewhere in apps/web; resolve it from the registry and
 * pass the result here (or to `SensitivityContextBanner` / `AdvisoryNotice`, which both render
 * through this component internally). `packages/domain/src/disclaimers.test.ts` runs a repo-wide
 * check that no ad-hoc disclaimer strings exist in apps/web source outside this path.
 *
 * INTEGRATION POINT (documented, not wired live — the registry isn't in `@black-book/domain`'s
 * public barrel yet; see the BB-095 handoff notes for the exact export statements pending merge
 * into packages/domain/src/index.ts): a real caller resolves copy via
 * `getDisclaimer(disclaimerClass)` from `@black-book/domain` and spreads the result into this
 * component's props — `<DisclaimerBanner {...getDisclaimer('site_wide')} />`. This component
 * itself takes plain, already-resolved strings so it has no compile-time dependency on that
 * export landing.
 *
 * Renders through `Notice tone="warning"` — the same muted, non-red treatment already used for
 * `SeedDataNotice` / `OfflineNotice`. No danger iconography, no "warning: danger" framing.
 */

import React from 'react';
import { Notice } from '@black-book/ui';

export type DisclaimerCopy = {
  readonly title: string;
  readonly body: string;
  /** ISO review date — every disclaimer carries one (BB-095 AC3). */
  readonly reviewDate: string;
};

export type DisclaimerBannerProps = DisclaimerCopy;

export function DisclaimerBanner({ title, body, reviewDate }: DisclaimerBannerProps) {
  return (
    <Notice tone="warning" title={title}>
      <p style={{ margin: 0 }}>{body}</p>
      <p className="bb-mono" style={{ margin: 0, marginTop: 'var(--bb-space-2)' }}>
        Reviewed {reviewDate}.
      </p>
    </Notice>
  );
}
