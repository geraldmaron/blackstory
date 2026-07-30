/**
 * App shell wrapper: header, offline notice, main body slot, and document footer.
 *
 * The Atlas (`/explore`) supplies both ends itself: its command bar replaces the site header, and
 * the mega footer is omitted so the composition stays map-first. `SiteShellHeader` and
 * `SiteShellFooter` are the two gates that make that route-specific, and both read the same
 * `isExploreMapShell` predicate so they cannot disagree about which surface is the Atlas.
 */

import type { ReactNode } from 'react';
import { OfflineNotice } from './OfflineNotice';
import { SiteShellFooter } from './SiteShellFooter';
import { SiteShellHeader } from './SiteShellHeader';

export type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="ds-shell">
      {/* Skip link (WCAG 2.4.1) renders once in app/layout.tsx, ahead of this shell. */}
      <SiteShellHeader />
      <OfflineNotice />
      <div className="ds-shell-body">{children}</div>
      <SiteShellFooter />
    </div>
  );
}
