'use client';

/**
 * Manual address/ZIP entry form for the `/locate` geocode experience. This is a purely
 * presentational, controlled component it validates and hands the trimmed input string to
 * `onSubmit`; `LocateExperience.tsx` owns the actual fetch to `/locate/api` and all loading/error
 * state. Kept separate so it stays trivially SSR-render-testable and so acceptance
 * criterion 4 ("geocoder failure provides manual place search") has one obvious re-entry point:
 * this same form renders again after a fallback, with the fallback's `message` passed through
 * `helperText`.
 *
 * Built on `@repo/ui`'s `FilterBar` (native fieldset/legend/label markup, no bespoke input)
 * rather than a hand-rolled `<input>`, so labelling/keyboard behavior matches every other filter
 * control in this app.
 */
import React from 'react';
import { FilterBar, Button } from '@repo/ui';

// See `../LocationPrivacyNotice.tsx`'s identical note: keeps this file safe under a classic JSX
// runtime (this app's own test runner) even though the automatic runtime doesn't need it.
void React;

export type ManualPlaceSearchFormProps = {
  readonly onSubmit: (address: string) => void;
  readonly disabled?: boolean;
  readonly helperText?: string;
  readonly defaultValue?: string;
  /** Input id — must be unique per page (explore reuses this form beside locate). */
  readonly fieldId?: string;
  readonly legend?: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly submitLabel?: string;
  readonly busyLabel?: string;
  readonly className?: string;
};

export function ManualPlaceSearchForm({
  onSubmit,
  disabled = false,
  helperText,
  defaultValue,
  fieldId = 'locate-address',
  legend = 'Search by address, city, or ZIP',
  label = 'Address, city and state, or ZIP',
  placeholder = '123 Main St, city, state, or ZIP',
  submitLabel = 'Find jurisdiction',
  busyLabel = 'Looking up…',
  className,
}: ManualPlaceSearchFormProps) {
  return (
    <div
      className={className ?? 'ds-stack'}
      style={className ? undefined : { gap: 'var(--ds-space-2)' }}
    >
      {helperText ? <p className="ds-sans">{helperText}</p> : null}
      <FilterBar
        legend={legend}
        fields={[
          {
            id: fieldId,
            name: 'address',
            label,
            type: 'search',
            placeholder,
            ...(defaultValue !== undefined ? { defaultValue } : {}),
          },
        ]}
        onSubmit={(values) => {
          const address = (values.address ?? '').trim();
          if (address) onSubmit(address);
        }}
        actions={
          <Button type="submit" disabled={disabled}>
            {disabled ? busyLabel : submitLabel}
          </Button>
        }
      />
    </div>
  );
}
