/** Records whether a provider receipt stayed within an evidence-pilot's total cost cap. */
export function evaluateEvidencePilotReceiptBudget(input: {
  readonly priorReservedCostUsd: number;
  readonly providerReportedCostUsd: number | null;
  readonly totalCostCapUsd: number;
}): {
  readonly passed: boolean;
  readonly reservationPassed: boolean;
  readonly providerReceiptAvailable: boolean;
  readonly cumulativeProviderReportedCostUsd: number | null;
  readonly failureReason:
    'prior_reservation_exceeded_total_cost_cap' | 'reported_charge_exceeded_total_cost_cap' | null;
} {
  if (
    !Number.isFinite(input.priorReservedCostUsd) ||
    input.priorReservedCostUsd < 0 ||
    !Number.isFinite(input.totalCostCapUsd) ||
    input.totalCostCapUsd <= 0 ||
    (input.providerReportedCostUsd !== null &&
      (!Number.isFinite(input.providerReportedCostUsd) || input.providerReportedCostUsd < 0))
  ) {
    throw new Error('Evidence pilot budget values must be finite and nonnegative');
  }
  const cumulativeProviderReportedCostUsd =
    input.providerReportedCostUsd === null
      ? null
      : input.priorReservedCostUsd + input.providerReportedCostUsd;
  const reservationPassed = input.priorReservedCostUsd <= input.totalCostCapUsd;
  const providerReceiptPassed =
    cumulativeProviderReportedCostUsd === null ||
    cumulativeProviderReportedCostUsd <= input.totalCostCapUsd;
  const passed = reservationPassed && providerReceiptPassed;
  return {
    passed,
    reservationPassed,
    providerReceiptAvailable: input.providerReportedCostUsd !== null,
    cumulativeProviderReportedCostUsd,
    failureReason: !reservationPassed
      ? 'prior_reservation_exceeded_total_cost_cap'
      : providerReceiptPassed
        ? null
        : 'reported_charge_exceeded_total_cost_cap',
  };
}
