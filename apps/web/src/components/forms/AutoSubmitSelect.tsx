/**
 * Native select that submits its parent GET form on change so facets apply
 * without a separate Apply button (v5 controls-apply-themselves rule).
 */
'use client';

import React from 'react';

export type AutoSubmitSelectProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly className?: string;
};

export function AutoSubmitSelect({
  id,
  name,
  label,
  defaultValue,
  options,
  className = 'ds-pill-select',
}: AutoSubmitSelectProps) {
  return (
    <label className={className} htmlFor={id}>
      <span className="ds-pill-select__label">{label}</span>
      <select
        className="ds-pill-select__control"
        id={id}
        name={name}
        defaultValue={defaultValue}
        onChange={(event) => {
          event.currentTarget.form?.requestSubmit();
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
