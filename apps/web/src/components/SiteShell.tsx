/**
 * App shell wrapper: header, offline notice, main body slot, and document footer.
 *
 * The Atlas (`/`) supplies both ends itself: its command bar replaces the site header, and the
 * mega footer is omitted so the composition stays map-first. `SiteShellHeader` and
 * `SiteShellFooter` are the two gates that make that route-specific, and both read the same
 * `isAtlasShell` predicate so they cannot disagree about which surface is the Atlas.
 */

import type { ReactNode } from 'react';
import { MapStageProvider } from '../app/(map)/MapStage';
import { OfflineNotice } from './OfflineNotice';
import { SiteShellFooter } from './SiteShellFooter';
import { SiteShellHeader } from './SiteShellHeader';

export type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    /* The plate provider sits above the shell, not inside a route group, so the WebGL context,
       style and camera survive every navigation instead of being torn down at a group boundary.
       It is mounted with no props on purpose: awaiting `loadMapStageBase()` here would make
       every route force-dynamic. It also builds no GL context until a surface first talks to the
       stage, so a reader who only ever opens a Utility surface never pays for one. */
    <MapStageProvider>
      <div className="ds-shell">
        {/* Skip link (WCAG 2.4.1) renders once in app/layout.tsx, ahead of this shell. */}
        <SiteShellHeader />
        <OfflineNotice />
        <div className="ds-shell-body">{children}</div>
        <SiteShellFooter />
      </div>
    </MapStageProvider>
  );
}
