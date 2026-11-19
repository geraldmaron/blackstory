'use client';

/**
 * Inline validation for a public form: a field is checked when the reader leaves it, rechecked
 * as they fix it, and every field is checked on submit, with focus moved to the first one that
 * needs work. The rules are the form's own pure `validate(FormData)`; server issues land in the
 * same map, so a server rejection draws exactly like a local one.
 */
import { useCallback, useState, type FocusEvent, type FormEvent } from 'react';

export type FieldErrors = Readonly<Record<string, string>>;
export type Validate = (data: FormData) => FieldErrors;

export function useFieldErrors(validate: Validate) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());

  const recheck = useCallback(
    (form: HTMLFormElement, name: string) => {
      const message = validate(new FormData(form))[name];
      setErrors((current) => {
        if (current[name] === message) return current;
        const next = { ...current };
        if (message === undefined) delete next[name];
        else next[name] = message;
        return next;
      });
    },
    [validate],
  );

  /** Form-level `onBlur`: focus events bubble in React, so one handler covers every field. */
  const onBlur = useCallback(
    (event: FocusEvent<HTMLFormElement>) => {
      const name = (event.target as unknown as HTMLInputElement).name;
      if (!name) return;
      // A field left empty on the way past is not an error yet; one with an answer is checked.
      const value = (event.target as unknown as HTMLInputElement).value;
      if (!touched.has(name) && value.trim().length === 0) return;
      setTouched((current) => new Set(current).add(name));
      recheck(event.currentTarget, name);
    },
    [recheck, touched],
  );

  /** Form-level `onChange`: once a field has been flagged, it clears the moment it is fixed. */
  const onChange = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const name = (event.target as unknown as HTMLInputElement).name;
      if (!name || (errors[name] === undefined && !touched.has(name))) return;
      recheck(event.currentTarget, name);
    },
    [errors, recheck, touched],
  );

  /** Checks everything. Returns true when the form may be sent; otherwise focuses the first error. */
  const validateAll = useCallback(
    (form: HTMLFormElement): boolean => {
      const found = validate(new FormData(form));
      setErrors(found);
      setTouched(new Set(Object.keys(found)));
      const names = Object.keys(found);
      if (names.length === 0) return true;
      const first = Array.from(form.elements).find((element) =>
        names.includes((element as HTMLInputElement).name),
      ) as HTMLElement | undefined;
      first?.focus();
      return false;
    },
    [validate],
  );

  /** Server field issues, drawn the same way as local ones. */
  const showIssues = useCallback(
    (form: HTMLFormElement | null, issues: readonly { field: string; message: string }[]) => {
      const next: Record<string, string> = {};
      for (const issue of issues) next[issue.field] ??= issue.message;
      setErrors(next);
      const first = form
        ? (Array.from(form.elements).find(
            (element) => next[(element as HTMLInputElement).name] !== undefined,
          ) as HTMLElement | undefined)
        : undefined;
      first?.focus();
    },
    [],
  );

  const reset = useCallback(() => {
    setErrors({});
    setTouched(new Set());
  }, []);

  return { errors, onBlur, onChange, validateAll, showIssues, reset } as const;
}
