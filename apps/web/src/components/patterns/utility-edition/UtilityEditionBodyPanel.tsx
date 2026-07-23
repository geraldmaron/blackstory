/**
 * Utility v6 edition body panel: Surface card for forms, notices, and status content.
 */
import React, { type ReactNode } from 'react';
import { utilityEditionPanelClassName } from './utility-edition-chrome';

void React;

export type UtilityEditionBodyPanelProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly labelledBy?: string;
};

export function UtilityEditionBodyPanel({
  children,
  className,
  labelledBy,
}: UtilityEditionBodyPanelProps) {
  const panelClass = [utilityEditionPanelClassName('body'), className].filter(Boolean).join(' ');
  return (
    <article
      className={panelClass}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
    >
      <div className="ds-utility-edition__body">{children}</div>
    </article>
  );
}
