/**
 * Approved empty-state notice for sparse theme-impact packet surfaces (indicators,
 * provenance, observations). Uses shared EmptyState so gaps read consistently.
 */

import React from 'react';
import { EmptyState } from '@repo/ui';
import { THEME_IMPACT_EMPTY_COPY, type ThemeImpactEmptyKind } from './theme-impact-copy';

export type ThemeImpactEmptyNoticeProps = {
  readonly kind: ThemeImpactEmptyKind;
};

export function ThemeImpactEmptyNotice({ kind }: ThemeImpactEmptyNoticeProps) {
  const copy = THEME_IMPACT_EMPTY_COPY[kind];
  return (
    <EmptyState className="ds-theme-impact__empty" title={copy.title}>
      {copy.body}
    </EmptyState>
  );
}
