/**
 * Utility v6 edition intro panel: indexed kicker, display title, and editorial lede.
 */
import React, { type ReactNode } from 'react';
import { utilityEditionPanelClassName } from './utility-edition-chrome';

void React;

export type UtilityEditionIntroProps = {
  readonly index?: string;
  readonly kicker: string;
  readonly title: ReactNode;
  readonly lede?: ReactNode;
  readonly variant?: 'intro' | 'status';
};

export function UtilityEditionIntro({
  index = '00',
  kicker,
  title,
  lede,
  variant = 'intro',
}: UtilityEditionIntroProps) {
  return (
    <article className={utilityEditionPanelClassName(variant)}>
      <header className="ds-utility-edition__header">
        <span className="ds-utility-edition__index" aria-hidden="true">
          {index}
        </span>
        <div>
          <p className="ds-utility-edition__kicker">{kicker}</p>
          <h1 className="ds-utility-edition__title">{title}</h1>
          {lede ? <p className="ds-utility-edition__lede">{lede}</p> : null}
        </div>
      </header>
    </article>
  );
}
