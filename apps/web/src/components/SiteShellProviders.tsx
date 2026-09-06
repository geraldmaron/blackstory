'use client';

/**
 * Client map providers for the public shell.
 *
 * `MapMomentStage` and `MapStageProvider` mount synchronously (no `next/dynamic`, no
 * `ssr: false`) so the shell they wrap — header, search, footer — is present in the
 * server-rendered HTML on every route, including a reader with JavaScript disabled and a
 * crawler that never runs it. Both providers are pure over their render path: no browser
 * global is read outside a `useEffect`, and neither takes props this shell has to await (see
 * each component's own doc comment — `MapStageProvider` always mounts "bare", built from no
 * server data). There is nothing here for SSR to fail on.
 *
 * The actual MapLibre instance stays client-only by construction, not by this boundary:
 * `MapStage.tsx` dynamically `import()`s `maplibre-gl` itself, inside a mount effect, which is
 * the one and only place the library's runtime is ever loaded (ADR-017). Removing `ssr: false`
 * here does not pull WebGL into the server bundle — it only lets the surrounding markup (the
 * plate's own inert `<div>`, the header, the footer) render up front.
 */

import type { ReactNode } from 'react';
import { MapMomentStage } from './room/MapMoment';
import { MapStageProvider } from './map-stage/MapStage';
import { OfflineNotice } from './OfflineNotice';
import { SiteShellFooter } from './SiteShellFooter';
import { SiteShellHeader } from './SiteShellHeader';

export type SiteShellProvidersProps = {
  readonly children: ReactNode;
};

export function SiteShellProviders({ children }: SiteShellProvidersProps) {
  return (
    <MapMomentStage>
      <MapStageProvider>
        <div className="ds-shell">
          <SiteShellHeader />
          <OfflineNotice />
          <div className="ds-shell-body">{children}</div>
          <SiteShellFooter />
        </div>
      </MapStageProvider>
    </MapMomentStage>
  );
}
