/**
 * Curated statute rows for theme-impact arc side rails. Summaries mirror national-catalog
 * entity cards; inline arc prose uses [[entityId|Label]] via LinkedProse.
 */

export type ThemeImpactLinkedStatuteView = {
  readonly entityId: string;
  readonly displayName: string;
  readonly yearLabel: string;
  readonly summary: string;
};

const REDLINING_LINKED_STATUTES: readonly ThemeImpactLinkedStatuteView[] = [
  {
    entityId: 'ent_law_home_owners_loan_act_1933',
    displayName: "Home Owners' Loan Act",
    yearLabel: '1933',
    summary:
      "Created the Home Owners' Loan Corporation to refinance distressed mortgages. The Corporation's later residential security maps left a federal paper trail of neighborhood risk grades that often named race as a credit factor.",
  },
  {
    entityId: 'ent_law_national_housing_act_1934',
    displayName: 'National Housing Act',
    yearLabel: '1934',
    summary:
      'Created the Federal Housing Administration to insure private mortgages. Underwriting manuals of the late 1930s treated racial occupancy change and missing restrictive covenants as risks to mortgage security.',
  },
  {
    entityId: 'ent_law_fair_housing_act_1968',
    displayName: 'Fair Housing Act',
    yearLabel: '1968',
    summary:
      'Title VIII of the Civil Rights Act of 1968 banned discrimination in the sale, rental, and financing of housing based on race, color, religion, or national origin (later amendments added sex, disability, and familial status).',
  },
  {
    entityId: 'ent_law_community_reinvestment_act_1977',
    displayName: 'Community Reinvestment Act',
    yearLabel: '1977',
    summary:
      'Directed federal bank regulators to encourage depository institutions to meet the credit needs of the communities they serve, including low- and moderate-income neighborhoods, after decades of documented lending withdrawal.',
  },
] as const;

const LINKED_STATUTES_BY_THEME: Readonly<Record<string, readonly ThemeImpactLinkedStatuteView[]>> =
  {
    redlining: REDLINING_LINKED_STATUTES,
  };

export function listThemeImpactLinkedStatutes(
  themeId: string,
): readonly ThemeImpactLinkedStatuteView[] {
  return LINKED_STATUTES_BY_THEME[themeId] ?? [];
}

const REDLINING_STATUTES_BY_QUESTION: Readonly<Record<string, readonly string[]>> = {
  Q1: ['ent_law_home_owners_loan_act_1933', 'ent_law_national_housing_act_1934'],
  Q3: ['ent_law_fair_housing_act_1968', 'ent_law_community_reinvestment_act_1977'],
};

const STATUTES_BY_QUESTION_BY_THEME: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  redlining: REDLINING_STATUTES_BY_QUESTION,
};

/** Statutes tied to a specific arc beat (inline cards), not the full side rail. */
export function listThemeImpactLinkedStatutesForQuestion(
  themeId: string,
  questionId: string,
): readonly ThemeImpactLinkedStatuteView[] {
  const entityIds = STATUTES_BY_QUESTION_BY_THEME[themeId]?.[questionId];
  if (!entityIds || entityIds.length === 0) return [];
  const byId = new Map(
    listThemeImpactLinkedStatutes(themeId).map((row) => [row.entityId, row] as const),
  );
  return entityIds.flatMap((entityId) => {
    const row = byId.get(entityId);
    return row ? [row] : [];
  });
}
