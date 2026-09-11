/**
 * Plain-language labels for canonical entity living status in catalog desks.
 */
const LIVING_STATUS_LABELS: Readonly<Record<string, string>> = {
  living: 'Living',
  deceased: 'Deceased',
  presumed_deceased: 'Presumed deceased',
  unknown: 'Unknown',
  // 3,623 of 4,097 rows — every place, organization, and event. Missing from this map, it fell
  // through to the raw column value while the upstream reader dropped it entirely.
  not_applicable: 'Not applicable',
};

export function formatLivingStatusLabel(status: string | undefined): string {
  if (!status) return '—';
  return LIVING_STATUS_LABELS[status] ?? status;
}
