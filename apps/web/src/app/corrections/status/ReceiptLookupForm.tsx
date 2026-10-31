'use client';

/**
 * Receipt-code lookup for the `/corrections/status` landing page. Client-only: it just
 * normalizes and forwards to `/corrections/status/[receiptCode]`, which already owns real
 * validation (the "Receipt not found" EmptyState). Kept deliberately thin rather than
 * duplicating the server-only BB-COR-… pattern from `receipt-code.ts` (node:crypto, not
 * client-safe) — one source of truth for what a valid code looks like.
 *
 * Deliberately does not import `../corrections.css`: this route's tree never loads it (neither
 * `AppealForm` nor `AbuseReportForm`, the sibling forms already living under `/corrections/status/
 * [receiptCode]`, reference it either), so `ds-corrections-send` styling would silently not
 * apply here. `ds-stack` and the room kit's `Field` are the classes this route actually has.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { Field, fieldControlProps } from '../../../components/room';

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
    const data = new FormData(event.currentTarget);
    const code = String(data.get('receiptCode') ?? '')
      .trim()
      .toUpperCase();
    /*
     * An empty submit used to return silently: no message, no focus move, nothing announced,
     * so the form simply appeared not to work. It still does not duplicate the BB-COR pattern
     * — that lives server-side in receipt-code.ts and stays the one source of truth for what a
     * valid code looks like — it only refuses to do nothing quietly.
     */
    if (!code) {
      setError('Enter the receipt code you were given when you sent the correction.');
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/corrections/status/${encodeURIComponent(code)}`);
  }

  return (
    <form className="ds-stack" onSubmit={handleSubmit} noValidate>
      <Field
        label="Receipt code"
        htmlFor={receiptCodeId}
        hint="You got this when you submitted a correction. It looks like BB-COR-XXXXXXXXXXXXXXXX."
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
          placeholder="BB-COR-XXXXXXXXXXXXXXXX"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Check status'}
      </Button>
    </form>
  );
}
