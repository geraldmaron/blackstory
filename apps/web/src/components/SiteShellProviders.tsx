'use client';

/**
 * Client map providers for the public shell.
 *
 * Map moment and MapLibre providers load without SSR so utility routes do not evaluate their
 * hooks during static prerender.
 */

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { OfflineNotice } from './OfflineNotice';
import { SiteShellFooter } from './SiteShellFooter';
import { SiteShellHeader } from './SiteShellHeader';

const MapMomentStage = dynamic(
  () => import('./room/MapMoment').then((module) => ({ default: module.MapMomentStage })),
  { ssr: false },
);

const MapStageProvider = dynamic(
  () => import('./map-stage/MapStage').then((module) => ({ default: module.MapStageProvider })),
  { ssr: false },
);

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
