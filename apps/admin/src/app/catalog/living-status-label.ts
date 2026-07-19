/**
 * Plain-language labels for canonical entity living status in catalog desks.
 */
const LIVING_STATUS_LABELS: Readonly<Record<string, string>> = {
  living: 'Living',
  deceased: 'Deceased',
  unknown: 'Unknown',
};

export function formatLivingStatusLabel(status: string | undefined): string {
  if (!status) return '—';
  return LIVING_STATUS_LABELS[status] ?? status;
}
