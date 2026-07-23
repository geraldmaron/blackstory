/**
 * Shared v6 utility edition wrapper: gutter mosaic atmosphere + main landmark +
 * Surface card stack. Used on compact public pages (locate, submit, corrections,
 * status, not-found).
 */
import React, { type ReactNode } from 'react';
import { EditionAtmosphereMosaic } from '../edition-atmosphere/EditionAtmosphereMosaic';
import {
  utilityEditionRootClassName,
  utilityEditionStackClassName,
} from './utility-edition-chrome';

void React;

export type UtilityEditionShellProps = {
  readonly mosaicSeed: string;
  readonly mosaicCount?: number;
  /** Value for data-utility-edition (route id for tests and theme hooks). */
  readonly editionKey: string;
  readonly children: ReactNode;
  readonly busy?: boolean;
};

export function UtilityEditionShell({
  mosaicSeed,
  mosaicCount = 12,
  editionKey,
  children,
  busy = false,
}: UtilityEditionShellProps) {
  return (
    <div className={utilityEditionRootClassName()} data-utility-edition={editionKey}>
      <EditionAtmosphereMosaic seedKey={mosaicSeed} count={mosaicCount} />
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
