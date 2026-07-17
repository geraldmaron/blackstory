/**
 * Budget guard for web-search adapters, wired into BB-033's cost-control evaluator rather than a
 * new one (bead deliverable 4: per-campaign query budgets, monthly spend caps, alerts).
 *
 * `@black-book/domain` cannot depend on `@black-book/security` at runtime -- `@black-book/security`
 * already depends on `@black-book/domain` (see ../internet-archive/shared/http-port.ts's doc
 * comment for the full circular-dependency reasoning; the same rule applies here). So this module
 * defines a `DailyBudgetEvaluator` port whose call shape mirrors BB-033's real
 * `evaluateDailyBudget` (packages/security/src/resource-controls.ts) closely enough that a thin,
 * one-line reference wrapper can back the port with the REAL evaluator -- all threshold/percent/
 * alert math still happens inside the real BB-033 function; the wrapper only forwards
 * arguments/return values (the `category` field is a specific literal union on the real function,
 * `string` here, so a direct 1:1 reassignment does not typecheck -- a wrapper is required, not
 * just useful). This is proved in web-search.test.ts, which imports the real function as a
 * devDependency only for that one test, mirroring
 * ../internet-archive/shared/http-port.test.ts's `buildRealSafeHttpClient` pattern for BB-030.
 * Production wiring (outside this package, in the apps/workers layer that already depends on both
 * `@black-book/domain` and `@black-book/security`) is expected to back this port with
 * `evaluateDailyBudget` from `@black-book/security` the same way.
 *
 * The per-campaign query cap below is genuinely new bookkeeping this bead asks for (BB-033 has no
 * per-campaign query concept) — it is deliberately simple local arithmetic, not a re-implementation
 * of BB-033's threshold/alert engine. The monthly spend ceiling is delegated entirely to the
 * injected evaluator so alerts and automated responses (BillingAlertPolicy, BudgetAutomatedResponse)
 * come from the real, already-audited BB-033 policy matrix.
 */

export type DailyBudgetDecision = {
  readonly allowed: boolean;
  readonly percentUsed: number;
  readonly softShutdownTriggered: boolean;
  readonly hardStopTriggered: boolean;
  readonly automatedResponse?: string;
  readonly reason?: string;
  readonly retryAfterMs?: number;
};

/** A single budget policy row — structurally identical to BB-033's `DailyBudgetPolicy`. */
export type BudgetGuardPolicyRow = {
  readonly category: string;
  readonly dailyCap: number;
  readonly unit: 'requests' | 'tokens' | 'bytes' | 'usd_cents';
  readonly softShutdownAtPercent: number;
  readonly hardStopAtPercent: number;
  readonly automatedResponse?: string;
};

/** Structurally identical call shape to BB-033's `evaluateDailyBudget` (see module doc comment). */
export type DailyBudgetEvaluator = (
  input: { readonly category: string; readonly consumed: number; readonly billingAlertPercent?: number },
  budgets?: Readonly<Record<string, BudgetGuardPolicyRow>>,
) => DailyBudgetDecision;

export type WebSearchCampaignBudgetPolicy = {
  /** Hard per-campaign cap on the number of external queries this campaign may ever issue. */
  readonly maxQueriesPerCampaign: number;
  /** Monthly USD-cent spend ceiling fed to the injected BB-033 evaluator. */
  readonly monthlySpendCapUsdCents: number;
  readonly costPerQueryUsdCents: number;
  /** BB-033 budget category key the monthly check is recorded under (e.g. "research_campaign"). */
  readonly monthlyBudgetCategory: string;
  readonly softShutdownAtPercent?: number;
  readonly hardStopAtPercent?: number;
};

export type WebSearchBudgetState = {
  readonly queriesIssuedThisCampaign: number;
  readonly queriesIssuedThisMonth: number;
};

export type WebSearchBudgetDecision = {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly monthlyBudget?: DailyBudgetDecision;
};

/**
 * Fail-closed per-campaign + monthly budget check. Denies immediately (without calling the
 * injected evaluator) once the local per-campaign query cap is reached; otherwise delegates the
 * monthly spend ceiling decision — including soft-shutdown/hard-stop thresholds and alerts — to
 * the injected BB-033 evaluator.
 */
export function evaluateWebSearchQueryBudget(input: {
  readonly policy: WebSearchCampaignBudgetPolicy;
  readonly state: WebSearchBudgetState;
  readonly evaluateDailyBudget: DailyBudgetEvaluator;
}): WebSearchBudgetDecision {
  if (input.state.queriesIssuedThisCampaign >= input.policy.maxQueriesPerCampaign) {
    return { allowed: false, reason: 'campaign_query_budget_exceeded' };
  }

  const monthlySpendUsdCents = input.state.queriesIssuedThisMonth * input.policy.costPerQueryUsdCents;
  const monthlyBudgetPolicy: Record<string, BudgetGuardPolicyRow> = {
    [input.policy.monthlyBudgetCategory]: {
      category: input.policy.monthlyBudgetCategory,
      dailyCap: input.policy.monthlySpendCapUsdCents,
      unit: 'usd_cents',
      softShutdownAtPercent: input.policy.softShutdownAtPercent ?? 80,
      hardStopAtPercent: input.policy.hardStopAtPercent ?? 100,
      automatedResponse: 'pause_research',
    },
  };

  const monthlyBudget = input.evaluateDailyBudget(
    { category: input.policy.monthlyBudgetCategory, consumed: monthlySpendUsdCents },
    monthlyBudgetPolicy,
  );

  if (!monthlyBudget.allowed) {
    return { allowed: false, reason: monthlyBudget.reason ?? 'monthly_spend_cap_exceeded', monthlyBudget };
  }
  return { allowed: true, monthlyBudget };
}
