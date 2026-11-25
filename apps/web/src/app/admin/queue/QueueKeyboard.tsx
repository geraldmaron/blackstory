'use client';
/**
 * j and k move focus through the Queue rows, Enter opens the focused row's link.
 *
 * The rows stay server-rendered. This island wraps them and reads each `<tr data-queue-row>` from
 * the DOM, so it needs no row data and imports nothing that reaches `pg`. The keys only act while
 * focus is already inside the table (WCAG 2.1.4: a bare-letter shortcut must not fire page-wide),
 * and they move real focus to the row's link, so the active row is the focused one for sighted
 * and screen-reader users alike and Enter is the link's own. Ignored when a modifier key is held,
 * so browser and screen-reader shortcuts survive.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { isTypingTarget, nextRowIndex } from '../../../admin/queue/queue-format';

export function QueueKeyboard({ children }: { readonly children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key !== 'j' && event.key !== 'k') return;
      if (!(event.target instanceof HTMLElement) || isTypingTarget(event.target)) return;
      const target = event.target;
      const rows = Array.from(node.querySelectorAll<HTMLElement>('tr[data-queue-row]'));
      const current = rows.findIndex((row) => row.contains(target));
      const next = rows[nextRowIndex(current, event.key === 'j' ? 1 : -1, rows.length)];
      const link = next?.querySelector<HTMLElement>('a[href]');
      if (!next || !link) return;
      event.preventDefault();
      link.focus();
      next.scrollIntoView({ block: 'nearest' });
    };

    // On the wrapper, not `document`: the listener only hears keys from focus inside the table.
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, []);

  return <div ref={root}>{children}</div>;
}
