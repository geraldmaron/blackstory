/**
 * Plain-language labels for graylist disposition and status values shown in the admin desk.
 */
const GRAYLIST_DISPOSITION_LABELS: Readonly<Record<string, string>> = {
  weak_signal_uncorroborated: 'Weak signal — not yet corroborated',
  below_threshold: 'Below relevance threshold',
  negative_only_signal: 'Negative-only signal',
  duplicate_of_included: 'Duplicate of an included candidate',
  awaiting_corroboration: 'Awaiting corroboration',
};

const GRAYLIST_STATUS_LABELS: Readonly<Record<string, string>> = {
  parked: 'Parked',
  promoted: 'Promoted to inbox',
  archived: 'Archived',
};

export function formatGraylistDisposition(disposition: string): string {
  return GRAYLIST_DISPOSITION_LABELS[disposition] ?? disposition.replaceAll('_', ' ');
}

export function formatGraylistStatus(status: string): string {
  return GRAYLIST_STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
}
