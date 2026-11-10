/** One date-time format for every admin desk, so the same instant never reads two ways. */
export function formatWhen(iso: string | null | undefined): string {
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

const DAY_MS = 86_400_000;

/** "today", "yesterday" or "3 days ago"; past 60 days the date reads better than a count. */
export function formatAgo(iso: string | Date | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '—';
  const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 60) return `${days} days ago`;
  return then.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
