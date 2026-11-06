/**
 * Pure helpers for the Queue table: the waiting-age wording and the j/k focus arithmetic.
 * No imports, so the client keyboard island and node:test can both load it.
 */

const DAY_MS = 86_400_000;

/** "103 days", "1 day" or "today". An unreadable or future time reads as today, never negative. */
export function formatWaitingDays(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.floor((now.getTime() - then) / DAY_MS);
  if (days < 1) return 'today';
  return days === 1 ? '1 day' : `${days.toLocaleString('en-US')} days`;
}

/** Requests carry their last activity, not the time they began waiting. */
export function waitingLabel(type: string): string {
  return type === 'request' ? 'last activity' : 'waiting since';
}

/**
 * The next highlighted row for a j (+1) or k (-1) press. Nothing highlighted yet: j lands on the
 * first row and k on the last. Movement stops at the ends rather than wrapping.
 */
export function nextRowIndex(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return delta === 1 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + delta));
}

/** True for keystrokes aimed at a form control, which the shortcuts must never steal. */
export function isTypingTarget(target: {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
}): boolean {
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
