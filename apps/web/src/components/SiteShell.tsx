/**
 * App shell wrapper: header, offline notice, main body slot, and document footer.
 *
 * Explore (`/explore`) is the instrument: no site header, no mega footer, its own
 * command bar. The door (`/`) is a reading surface: same room chrome as the archive,
 * mast plus plate in the page. `SiteShellHeader` and `SiteShellFooter` read the same
 * surface-class registry so they cannot disagree.
 */

import type { ReactNode } from 'react';
import { SiteShellProviders } from './SiteShellProviders';

export type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return <SiteShellProviders>{children}</SiteShellProviders>;
}
