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
    <div className="bb-shell">
      <SiteHeader />
      <DegradedModeNotice />
      <OfflineNotice />
      <div className="bb-shell-body">{children}</div>
      <SiteFooter />
    </div>
  );
}
