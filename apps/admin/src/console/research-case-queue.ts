/**
 * Pure helpers for the research-case queue client: detail parsing, selection limits,
 * and entity-like title heuristics. No I/O — safe for unit tests and client bundles.
 */
import type { ConsoleFixtureRow } from './model';

/** Matches console bulk-action ceiling and story review queue limit. */
export const RESEARCH_CASE_QUEUE_BULK_LIMIT = 50;

export function parseCandidateIdFromDetail(detail: string): string | null {
  const match = detail.match(/submission\s+(\S+)/i);
  return match?.[1] ?? null;
}

export function parseUpdatedAtFromDetail(detail: string): string | null {
  const match = detail.match(/updated\s+([^\s·]+)/i);
  return match?.[1] ?? null;
}

export function resolveRowUpdatedAt(row: ConsoleFixtureRow): string {
  return parseUpdatedAtFromDetail(row.detail) ?? '';
}

export function formatResearchCaseWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Titles that resemble people or organizations — private research cases with no public page.
 * Used to avoid implying a public entity link exists.
 */
export function isEntityLikeTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;

  if (
    /\b(register|minutes|records|documents|archive|collection|index|ledger|log|file|docket)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  if (/^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][A-Za-z'.-]+/.test(trimmed)) {
    return true;
  }

  if (
    /\b(Association|Committee|Society|Church|School|Union|Council|Fund|League|Institute|Center|Centre)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  const words = trimmed.split(/\s+/);
  const capitalized = words.filter((word) => /^[A-Z]/.test(word));
  return capitalized.length >= 2 && words.length <= 5;
}

export function toggleResearchCaseSelection(
  selected: ReadonlySet<string>,
  rowId: string,
  limit = RESEARCH_CASE_QUEUE_BULK_LIMIT,
): ReadonlySet<string> {
  if (selected.has(rowId)) {
    const next = new Set(selected);
    next.delete(rowId);
    return next;
  }
  if (selected.size >= limit) return selected;
  return new Set([...selected, rowId]);
}

export function toggleAllResearchCaseSelection(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
  selectAll: boolean,
  limit = RESEARCH_CASE_QUEUE_BULK_LIMIT,
): ReadonlySet<string> {
  if (!selectAll) {
    const next = new Set(selected);
    for (const id of visibleIds) next.delete(id);
    return next;
  }

  const next = new Set(selected);
  for (const id of visibleIds) {
    if (next.size >= limit) break;
    next.add(id);
  }
  return next;
}

export function allVisibleResearchCasesSelected(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
}

export function dataSourceCountLabel(
  count: number,
  dataSource: 'live' | 'fixture' | 'unavailable',
): string {
  switch (dataSource) {
    case 'live':
      return `${count} live record${count === 1 ? '' : 's'}`;
    case 'fixture':
      return `${count} sample fixture${count === 1 ? '' : 's'}`;
    case 'unavailable':
      return 'Unavailable — sample fixtures';
  }
}
