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
 * Built on `@blap/ui`'s `FilterBar` (native fieldset/legend/label markup, no bespoke input)
 * rather than a hand-rolled `<input>`, so labelling/keyboard behavior matches every other filter
 * control in this app.
 */
import React from 'react';
import { FilterBar, Button } from '@blap/ui';

// See `../LocationPrivacyNotice.tsx`'s identical note: keeps this file safe under a classic JSX
// runtime (this app's own test runner) even though the automatic runtime doesn't need it.
void React;

export type ManualPlaceSearchFormProps = {
  readonly onSubmit: (address: string) => void;
  readonly disabled?: boolean;
  readonly helperText?: string;
  readonly defaultValue?: string;
};

export function ManualPlaceSearchForm({
  onSubmit,
  disabled = false,
  helperText,
  defaultValue,
}: ManualPlaceSearchFormProps) {
  return (
    <div className="bp-stack" style={{ gap: 'var(--bp-space-2)' }}>
      {helperText ? <p className="bp-sans">{helperText}</p> : null}
      <FilterBar
        legend="Search by address, city, or ZIP"
        fields={[
          {
            id: 'locate-address',
            name: 'address',
            label: 'Address, city and state, or ZIP',
            type: 'search',
            placeholder: '123 Main St, city, state, or ZIP',
            ...(defaultValue !== undefined ? { defaultValue } : {}),
          },
        ]}
        onSubmit={(values) => {
          const address = (values.address ?? '').trim();
          if (address) onSubmit(address);
        }}
        actions={
          <Button type="submit" disabled={disabled}>
            {disabled ? 'Looking up…' : 'Find jurisdiction'}
          </Button>
        }
      />
    </div>
  );
}
