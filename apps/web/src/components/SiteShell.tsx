/**
 * App shell wrapper: header, offline notice, main body slot, footer.
 */

import type { ReactNode } from 'react';
import { DegradedModeNotice } from './DegradedModeNotice';
import { OfflineNotice } from './OfflineNotice';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

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
      <SiteFooter />
    </div>
  );
}
