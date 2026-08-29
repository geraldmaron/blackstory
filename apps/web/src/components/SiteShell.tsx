/**
 * App shell wrapper: header, offline notice, main body slot, and document footer.
 *
 * The Atlas (`/explore`) is the instrument: no site header, no mega footer, its own
 * command bar. The door (`/`) is a reading surface: same room chrome as the archive,
 * mast plus plate in the page. `SiteShellHeader` and `SiteShellFooter` read the same
 * surface-class registry so they cannot disagree.
 */

import type { ReactNode } from 'react';
import { MapStageProvider } from './map-stage/MapStage';
import { MapMomentStage } from './room/MapMoment';
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
    /* The moment stage sits ABOVE the plate provider, not inside a page. The plate renders as a
       sibling of `{children}`, so a stage mounted down in the route tree would be invisible to
       the very element that has to move into its slot. One stage per document also matches what
       the stage actually arbitrates: which single moment, anywhere on this page, holds the plate. */
    <MapMomentStage>
      <MapStageProvider>
        <div className="ds-shell">
          {/* Skip link (WCAG 2.4.1) renders once in app/layout.tsx, ahead of this shell. */}
          <SiteShellHeader />
          <OfflineNotice />
          <div className="ds-shell-body">{children}</div>
          <SiteShellFooter />
        </div>
      </MapStageProvider>
    </MapMomentStage>
  );
}
