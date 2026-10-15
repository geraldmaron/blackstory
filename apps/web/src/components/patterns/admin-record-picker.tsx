'use client';
/** Binding: docs/ui/patterns-admin-editorial.md. Stable IDs, canonical names, one lookup API. */
import { useEffect, useId, useState } from 'react';
import { Select } from 'baseui/select';
import { FormControl } from 'baseui/form-control';
import { useAdminAuth } from '@/admin/auth/AdminAuthProvider';
export type EditorialRecordOption = { id: string; display_name: string };
export function AdminRecordPicker({
  label,
  value,
  onSelect,
  disabled = false,
}: {
  label: string;
  value?: EditorialRecordOption | undefined;
  onSelect: (record: EditorialRecordOption) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { getIdToken } = useAdminAuth();
  const [query, setQuery] = useState(''),
    [options, setOptions] = useState<EditorialRecordOption[]>([]);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2 || disabled) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getIdToken();
          if (!token) throw new Error('Sign in again to find records. Your edits remain here.');
          const response = await fetch(
            `/admin/api/editorial/entities?q=${encodeURIComponent(search)}`,
            { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
          );
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error ?? 'Records could not be loaded. Try another search.');
          if (!controller.signal.aborted) setOptions(data.items);
        } catch (failure) {
          if (!controller.signal.aborted)
            setError(failure instanceof Error ? failure.message : 'Records could not be loaded.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, disabled, getIdToken]);
  return (
    <div>
      <FormControl label={label} htmlFor={id}>
        <Select
          id={id}
          aria-label={label}
          size="compact"
          labelKey="display_name"
          valueKey="id"
          options={options}
          value={value ? [value] : []}
          clearable={false}
          disabled={disabled}
          isLoading={loading}
          placeholder="Find a record by name or ID"
          noResultsMsg={
            error
              ? 'Search unavailable'
              : loading
                ? 'Searching records…'
                : query.trim().length < 2
                  ? 'Type at least two characters'
                  : 'No matching records'
          }
          filterOptions={(items) => items}
          onInputChange={(event) => setQuery(event.currentTarget.value)}
          onChange={({ value: next }) => {
            const record = next[0] as EditorialRecordOption | undefined;
            if (record) onSelect(record);
          }}
        />
      </FormControl>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
