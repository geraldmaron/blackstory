
/**
 * Native filter controls (fieldset + labelled inputs) for result refinement.
 */

'use client';

import React, { type FormEvent, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type FilterField = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly type?: 'search' | 'text' | 'select';
  readonly placeholder?: string;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue?: string;
};

export type FilterBarProps = {
  readonly legend: string;
  readonly fields: readonly FilterField[];
  readonly onSubmit?: (values: Record<string, string>) => void;
  /** Native form method for progressive enhancement when `onSubmit` is omitted. */
  readonly method?: 'get' | 'post';
  /** Native form action for progressive enhancement when `onSubmit` is omitted. */
  readonly action?: string;
  readonly className?: string;
  readonly actions?: ReactNode;
};

export function FilterBar({
  legend,
  fields,
  onSubmit,
  method = 'get',
  action,
  className,
  actions,
}: FilterBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Allow native GET/POST navigation when no client handler is provided (JS-off PE).
    if (!onSubmit) {
      return;
    }
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of fields) {
      const raw = data.get(field.name);
      values[field.name] = typeof raw === 'string' ? raw : '';
    }
    onSubmit(values);
  }

  return (
    <form
      className={cx('bp-filters', className)}
      method={method}
      action={action}
      onSubmit={handleSubmit}
    >      <fieldset className="bp-filters__fieldset">
        <legend className="bp-filters__legend">{legend}</legend>
        <div className="bp-filters__fields">
          {fields.map((field) => (
            <div key={field.id} className="bp-filters__field">
              <label className="bp-filters__label" htmlFor={field.id}>
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  className="bp-filters__control"
                  id={field.id}
                  name={field.name}
                  defaultValue={field.defaultValue}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="bp-filters__control"
                  id={field.id}
                  name={field.name}
                  type={field.type ?? 'search'}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                />
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="bp-filters__actions">
        {actions ?? (
          <button type="submit" className="bp-button bp-button--primary">
            Apply filters
          </button>
        )}
      </div>
    </form>
  );
}
