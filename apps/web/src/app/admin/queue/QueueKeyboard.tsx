'use client';
/**
 * j and k move a highlight through the Queue rows, Enter opens the highlighted row's link.
 *
 * The rows stay server-rendered. This island wraps them and reads each `<tr data-queue-row>` from
 * the DOM, so it needs no row data and imports nothing that reaches `pg`. Ignored while typing in
 * a form control and when a modifier key is held, so browser and screen-reader shortcuts survive.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { isTypingTarget, nextRowIndex } from '../../../admin/queue/queue-format';

const ACTIVE_ATTRIBUTE = 'data-queue-active';

export function QueueKeyboard({ children }: { readonly children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const index = useRef(-1);

  useEffect(() => {
    const rows = (): HTMLElement[] =>
      Array.from(root.current?.querySelectorAll<HTMLElement>('tr[data-queue-row]') ?? []);

    const highlight = (next: number) => {
      const all = rows();
      all.forEach((row) => row.removeAttribute(ACTIVE_ATTRIBUTE));
      index.current = next;
      const row = all[next];
      if (!row) return;
      row.setAttribute(ACTIVE_ATTRIBUTE, 'true');
      row.scrollIntoView({ block: 'nearest' });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof HTMLElement && isTypingTarget(event.target)) return;
      if (event.key === 'j' || event.key === 'k') {
        const next = nextRowIndex(index.current, event.key === 'j' ? 1 : -1, rows().length);
        if (next >= 0) {
          event.preventDefault();
          highlight(next);
        }
        return;
      }
      if (event.key === 'Enter') {
        const row = rows()[index.current];
        const href = row?.getAttribute('data-queue-row');
        if (!href) return;
        // A focused link or button handles its own Enter; only take it when nothing else will.
        if (event.target instanceof HTMLElement && event.target.closest('a, button')) return;
        event.preventDefault();
        window.location.assign(href);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return <div ref={root}>{children}</div>;
}
