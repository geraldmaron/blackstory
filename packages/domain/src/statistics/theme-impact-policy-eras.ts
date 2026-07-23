/**
 * Human-readable labels for theme-impact policy era ids used in packet rows
 * and public storytelling surfaces.
 */

export type ThemeImpactPolicyEraView = {
  readonly id: string;
  readonly label: string;
  readonly span?: string;
};

const REDLINING_ERA_LABELS: Record<string, Omit<ThemeImpactPolicyEraView, 'id'>> = {
  holc_fha: {
    label: 'HOLC / FHA grading & federal mortgage gatekeeping',
    span: 'circa 1933–1968',
  },
  fair_housing: {
    label: 'Fair Housing & early enforcement',
    span: 'circa 1968–1980s',
  },
  cra_contemporary: {
    label: 'CRA / contemporary lending disparity',
    span: 'circa 1977–present',
  },
};

const DRUG_POLICY_ERA_LABELS: Record<string, Omit<ThemeImpactPolicyEraView, 'id'>> = {
  pre_drug_war: {
    label: 'Pre–drug-war enforcement baseline',
    span: 'through circa 1970',
  },
  drug_war_escalation: {
    label: 'Escalation & scheduling',
    span: 'circa 1971–1985',
  },
  crack_cocaine_era: {
    label: 'Crack / mandatory-minimum peak',
    span: 'circa 1986–2000s',
  },
  sentencing_reform: {
    label: 'Reform & partial rollback',
    span: 'circa 2010–present',
  },
};

const ERA_LABELS: Record<string, Omit<ThemeImpactPolicyEraView, 'id'>> = {
  ...REDLINING_ERA_LABELS,
  ...DRUG_POLICY_ERA_LABELS,
};

export function resolveThemeImpactPolicyEra(eraId: string): ThemeImpactPolicyEraView {
  const known = ERA_LABELS[eraId];
  if (known) {
    return { id: eraId, ...known };
  }
  return {
    id: eraId,
    label: eraId.replaceAll('_', ' '),
  };
}

export function resolveThemeImpactPolicyEras(
  eraIds: readonly string[],
): readonly ThemeImpactPolicyEraView[] {
  return eraIds.map(resolveThemeImpactPolicyEra);
}
