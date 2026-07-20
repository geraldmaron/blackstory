/**
 * App shell wrapper: header, offline notice, main body slot, and document footer.
 * Explore is a dedicated map surface (`.ds-shell:has(.ds-explore-stage)`): header +
 * full-viewport map canvas. The mega footer is omitted on that route via
 * `SiteShellFooter` so the composition stays map-first (homepage keeps the footer).
 */

import type { ReactNode } from 'react';
import { DegradedModeNotice } from './DegradedModeNotice';
import { OfflineNotice } from './OfflineNotice';
import { SiteHeader } from './SiteHeader';
import { SiteShellFooter } from './SiteShellFooter';

export type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="ds-shell">
      {/* Skip link (WCAG 2.4.1) renders once in app/layout.tsx, ahead of this shell. */}
      <SiteHeader />
      <DegradedModeNotice />
      <OfflineNotice />
      <div className="ds-shell-body">{children}</div>
      <SiteShellFooter />
    </div>
  );
}
