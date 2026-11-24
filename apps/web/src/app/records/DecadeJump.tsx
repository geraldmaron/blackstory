/**
 * "Jump to decade" for the pager. A GET form whose select names a page, so without JavaScript
 * it still lands on the right page; with it, Go lands on that decade's first row (the page plus
 * its anchor). It moves on Go, never on change: a closed select fires `change` on every arrow
 * key in Windows and Linux browsers, which sent a keyboard reader to the first decade they
 * passed (WCAG 3.2.2).
 */
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { buttonClassName } from '@repo/ui';

void React;

export type DecadeJumpProps = {
  readonly jumps: readonly {
    readonly label: string;
    readonly page: number;
    readonly href: string;
  }[];
  /** Every other param of the current narrowing, carried as hidden fields. */
  readonly preserved: readonly (readonly [string, string])[];
};

export function DecadeJump({ jumps, preserved }: DecadeJumpProps) {
  const router = useRouter();
  return (
    <form
      className="ds-records-jump"
      action="/archive"
      method="get"
      onSubmit={(event) => {
        const select = event.currentTarget.elements.namedItem('page') as HTMLSelectElement;
        const jump = jumps[select.selectedIndex - 1];
        if (jump === undefined) return;
        event.preventDefault();
        router.push(jump.href);
      }}
    >
      {preserved.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="ds-records-jump__field">
        <span className="ds-visually-hidden">Jump to decade</span>
        <select className="ds-records-jump__select" name="page" defaultValue="">
          <option value="" disabled>
            Jump to decade
          </option>
          {jumps.map((jump) => (
            <option key={jump.label} value={jump.page}>
              {jump.label}
            </option>
          ))}
        </select>
        <svg className="ds-records-jump__caret" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </label>
      <button className={buttonClassName('secondary')} type="submit">
        Go
      </button>
    </form>
  );
}
