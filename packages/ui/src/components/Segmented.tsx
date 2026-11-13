/**
 * Mutually exclusive options on the same data (List | Timeline, All | Chapters | Entries).
 * A sunken radius-8 track; the selected option is a raised thumb with ink text and heavier
 * weight, never color alone. For moving between places use {@link Tabs}.
 *
 * Two forms. With `href` on every option it is a set of links (the choice lives in the URL,
 * the current one carries `aria-current`). Otherwise it is a native radio group named `name`,
 * which works inside a GET form with no JavaScript and reports changes through `onChange`.
 */

import React, { type ElementType, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type SegmentedOption = {
  readonly value: string;
  readonly label: ReactNode;
  readonly href?: string;
};

export type SegmentedProps = {
  /** Accessible name for the group. */
  readonly label: string;
  readonly options: readonly SegmentedOption[];
  readonly value: string;
  /** Radio form: the field name. */
  readonly name?: string;
  readonly onChange?: (value: string) => void;
  readonly linkAs?: ElementType;
  readonly className?: string;
};

export function Segmented({
  label,
  options,
  value,
  name,
  onChange,
  linkAs: LinkAs = 'a',
  className,
}: SegmentedProps) {
  if (options.every((option) => option.href !== undefined)) {
    return (
      <nav className={cx('ds-segmented', className)} aria-label={label}>
        {options.map((option) => (
          <LinkAs
            key={option.value}
            className="ds-segmented__option"
            href={option.href}
            aria-current={option.value === value ? 'page' : undefined}
          >
            {option.label}
          </LinkAs>
        ))}
      </nav>
    );
  }

  return (
    <div className={cx('ds-segmented', className)} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="ds-segmented__option">
          <input
            className="ds-segmented__input"
            type="radio"
            name={name ?? label}
            value={option.value}
            {...(onChange
              ? {
                  checked: option.value === value,
                  onChange: () => onChange(option.value),
                }
              : // Uncontrolled in a plain form: the browser moves the selection, the form submits it.
                { defaultChecked: option.value === value })}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
