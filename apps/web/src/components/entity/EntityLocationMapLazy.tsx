/**
 * Client boundary that defers EntityLocationMap (and its MapLibre chunk) until
 * the entity aside hydrates. Keeps soft navigation to `/entity/[id]` lighter:
 * the RSC shell can paint while the map loads behind a MapFrame placeholder.
 */
'use client';

import dynamic from 'next/dynamic';
import { MapFrame } from '@repo/ui';
import type { EntityLocationMapProps } from './EntityLocationMap';

const EntityLocationMap = dynamic(
  () => import('./EntityLocationMap').then((mod) => mod.EntityLocationMap),
  {
    ssr: false,
    loading: () => (
      <MapFrame
        title="Map loading"
        caption="Loading public-precision street context…"
        pins={[]}
      />
    ),
  },
);

export function EntityLocationMapLazy(props: EntityLocationMapProps) {
  return <EntityLocationMap {...props} />;
}
