/**
 * About mosaic mast — full-bleed living collage behind the product thesis.
 * Resolves entity link targets for tiles that open published records.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { listPublicEntityViews } from '../../lib/public-data/source';
import {
  ATMOSPHERE_ATTRIBUTION_HREF,
  ATMOSPHERE_TILE_CREDITS,
} from './tile-credits';
import {
  LivingAtmosphereMosaic,
  type MosaicEntityLink,
} from './LivingAtmosphereMosaic';
import './atmosphere.css';

function humanizeEntityId(entityId: string): string {
  return entityId
    .replace(/^ent_/, '')
    .replace(/_\d+$/, '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export type AboutMosaicMastProps = {
  readonly children: ReactNode;
};

export async function AboutMosaicMast({ children }: AboutMosaicMastProps) {
  const { data: entities } = await listPublicEntityViews();
  const byId = new Map(entities.map((entity) => [entity.id, entity] as const));

  const entityLinks: Readonly<Record<string, MosaicEntityLink>> = Object.fromEntries(
    ATMOSPHERE_TILE_CREDITS.map((tile) => {
      const entity = byId.get(tile.entityId);
      const label = entity?.displayName.trim() || humanizeEntityId(tile.entityId);
      return [
        tile.entityId,
        { href: `/entity/${tile.entityId}`, label } satisfies MosaicEntityLink,
      ];
    }),
  );

  return (
    <header className="ds-about-mast">
      <LivingAtmosphereMosaic
        seedKey="about"
        fillContainer
        entityLinks={entityLinks}
        className="ds-about-mast__plane"
      />
      <div className="ds-container ds-about-mast__inner">
        {/* Opaque fixed-ink plate: WCAG pairs only — never translucent over mosaic tiles. */}
        <div className="ds-about-mast__copy">
          {children}
          <p className="ds-about-mast__credit">
            Archive mosaic · symbolic atmosphere · select a tile to open its record.{' '}
            <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
          </p>
        </div>
      </div>
    </header>
  );
}

/** @deprecated Prefer AboutMosaicMast — kept as alias during the about redesign. */
export const AboutMosaicRail = AboutMosaicMast;
