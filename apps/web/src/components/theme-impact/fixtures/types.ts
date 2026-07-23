/**
 * Local fixture types for theme-impact packets. Re-exports the domain view model
 * so pages can render live Postgres packets and fixtures with one shape.
 */
import type { ThemeImpactPacketView, ThemeImpactProvenanceView } from '@repo/domain';

export type { ThemeImpactGapState, ThemeImpactMethodStance } from '@repo/domain';

export const THEME_IMPACT_GAP_STATES = ['insufficient_evidence', 'modeled'] as const;
export const THEME_IMPACT_METHOD_STANCES = ['juxtaposition', 'gated_causal_claim'] as const;

/** @deprecated Use ThemeImpactProvenanceView from @repo/domain */
export type ThemeImpactProvenance = ThemeImpactProvenanceView;

/** Public packet view — live rows and fixtures share this contract. */
export type ThemeImpactPacketFixture = ThemeImpactPacketView;

export type ThemeImpactCatalogEntry = {
  readonly id: string;
  readonly title: string;
  readonly priority: 'P0' | 'P1';
  readonly lede: string;
  readonly available: boolean;
};
