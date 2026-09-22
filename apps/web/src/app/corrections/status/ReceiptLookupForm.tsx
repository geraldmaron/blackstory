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
import { useId, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { Field } from '../../../components/room';

export function ReceiptLookupForm() {
  const router = useRouter();
  const receiptCodeId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get('receiptCode') ?? '')
      .trim()
      .toUpperCase();
    if (!code) return;
    router.push(`/corrections/status/${encodeURIComponent(code)}`);
  }

  return (
    <form className="ds-stack" onSubmit={handleSubmit} noValidate>
      <Field
        label="Receipt code"
        htmlFor={receiptCodeId}
        hint="You got this when you submitted a correction. It looks like BB-COR-XXXXXXXXXXXXXXXX."
      >
        <input
          id={receiptCodeId}
          name="receiptCode"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="BB-COR-XXXXXXXXXXXXXXXX"
        />
      </Field>
      <Button type="submit">Check status</Button>
    </form>
  );
}
