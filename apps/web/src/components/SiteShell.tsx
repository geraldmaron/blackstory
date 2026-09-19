/**
 * App shell wrapper: header, offline notice, main body slot, and document footer.
 *
 * The Door (`/` journey, `/explore` browse) shares room chrome: `SiteShellHeader` mounts the
 * CommandBar; browse keeps that bar and embeds atlas instruments (no second instrument bar).
 * `SiteShellHeader` and `SiteShellFooter` read the same surface-class registry so they cannot
 * disagree. The legacy `instrument` class still suppresses chrome if ever emitted.
 */

import type { ReactNode } from 'react';
import { SiteShellProviders } from './SiteShellProviders';

export type SiteShellProps = {
  readonly children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return <SiteShellProviders>{children}</SiteShellProviders>;
}
