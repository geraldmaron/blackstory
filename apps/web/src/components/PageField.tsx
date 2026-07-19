/**
 * Decorative shell page-field motif layer for non-map archive surfaces.
 *
 * Renders a full-bleed, aria-hidden repeating SVG tile behind routed page content.
 * Map routes opt out via selectPageField(null) and shell.css `:has([data-surface='map'])`.
 */
'use client';

import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import {
  selectPageField,
  type PageFieldSelection,
} from './atmosphere/select-page-field';

const CORNER_ACCENT_MOTIFS = new Set<NonNullable<PageFieldSelection>['motifId']>([
  'bands',
  'ledger',
]);

export type PageFieldProps = {
  readonly selection: NonNullable<PageFieldSelection>;
};

export function PageField({ selection }: PageFieldProps) {
  const layerStyle = {
    '--ds-page-field-light': `url("${selection.lightPath}")`,
    '--ds-page-field-dark': `url("${selection.darkPath}")`,
  } as CSSProperties;

  const rootClass = [
    'ds-page-field',
    CORNER_ACCENT_MOTIFS.has(selection.motifId) ? 'ds-page-field--accents' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={rootClass} aria-hidden="true" style={layerStyle} />;
}

export function usePageFieldSelection(): PageFieldSelection {
  const pathname = usePathname();
  return selectPageField(pathname);
}

export type { PageFieldSelection } from './atmosphere/select-page-field';
