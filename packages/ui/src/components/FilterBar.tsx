/**
 * Native filter controls (fieldset + labelled inputs) for result refinement.
 */

'use client';

import type { FormEvent, ReactNode } from 'react';
import { cx } from '../utils/cx.js';

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
  readonly className?: string;
  readonly actions?: ReactNode;
};

export function FilterBar({ legend, fields, onSubmit, className, actions }: FilterBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSubmit) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of fields) {
      const raw = data.get(field.name);
      values[field.name] = typeof raw === 'string' ? raw : '';
    }
    onSubmit(values);
  }

  return (
    <form className={cx('bb-filters', className)} onSubmit={handleSubmit}>
      <fieldset className="bb-filters__fieldset">
        <legend className="bb-filters__legend">{legend}</legend>
        <div className="bb-filters__fields">
          {fields.map((field) => (
            <div key={field.id} className="bb-filters__field">
              <label className="bb-filters__label" htmlFor={field.id}>
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  className="bb-filters__control"
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
                  className="bb-filters__control"
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
      <div className="bb-filters__actions">
        {actions ?? (
          <button type="submit" className="bb-button bb-button--primary">
            Apply filters
          </button>
        )}
      </div>
    </form>
  );
}
