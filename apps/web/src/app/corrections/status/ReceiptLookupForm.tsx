'use client';

/**
 * Receipt-code lookup for `/corrections/status`. Client-only: it normalizes the code and forwards
 * to `/corrections/status/[receiptCode]`, which owns real validation (the "Receipt not found"
 * page). It does not duplicate the server-only BB-COR pattern from `receipt-code.ts`; it only
 * refuses to do nothing quietly on an empty submit.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Field, fieldControlProps } from '../../../components/forms/fields';
import { RequiredMark, SubmitRow } from '../../../components/forms/FormKit';

export function ReceiptLookupForm() {
  const router = useRouter();
  const receiptCodeId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('receiptCode') ?? '')
      .replace(/[\s.]+/g, '')
      .toUpperCase();
    if (!code) {
      setError('Enter the receipt code you were given when you sent the correction.');
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/corrections/status/${encodeURIComponent(code)}`);
  }

  return (
    <form className="ds-form" onSubmit={handleSubmit} noValidate>
      <Field
        label={
          <>
            Receipt code
            <RequiredMark />
          </>
        }
        htmlFor={receiptCodeId}
        hint="It looks like BB-COR followed by sixteen characters, the digits 0 to 9 and the letters A to F."
        {...(error ? { error } : {})}
      >
        <input
          {...fieldControlProps({ htmlFor: receiptCodeId, hint: true, error })}
          ref={inputRef}
          name="receiptCode"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="BB-COR-"
        />
      </Field>
      <SubmitRow pending={pending} label="Check status" pendingLabel="Checking" />
    </form>
  );
}
