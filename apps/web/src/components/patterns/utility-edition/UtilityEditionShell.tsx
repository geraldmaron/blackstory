/**
 * Shared v6 utility edition wrapper: atmosphere canvas + main landmark + Surface
 * card stack. Used on compact public pages (locate, submit, corrections, status,
 * not-found). Decorative gutter mosaic tiles are not mounted.
 */
import React, { type ReactNode } from 'react';
import {
  utilityEditionRootClassName,
  utilityEditionStackClassName,
} from './utility-edition-chrome';

void React;

export type UtilityEditionShellProps = {
  readonly editionKey: string;
  readonly children: ReactNode;
  readonly busy?: boolean;
};

export function UtilityEditionShell({
  editionKey,
  children,
  busy = false,
}: UtilityEditionShellProps) {
  return (
    <div className={utilityEditionRootClassName()} data-utility-edition={editionKey}>
      <main
        className="ds-container ds-page"
        id="main"
        {...(busy ? { 'aria-busy': true, 'aria-live': 'polite' as const } : {})}
      >
        <div className={utilityEditionStackClassName()}>{children}</div>
      </main>
    </div>
  );
}
