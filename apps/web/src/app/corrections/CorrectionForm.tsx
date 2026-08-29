'use client';

/**
 * Public correction intake form. Posts to `/corrections/api` quarantine-only, never
 * public. Supports entity/claim/source/location targets, structured categories, source URL,
 * privacy consent, and returns a receipt code on success.
 */
import { useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Notice } from '@repo/ui';
import { ChoiceField, Field } from '../../components/room';
import { ReceiptBlock } from './ReceiptBlock';
import {
  CORRECTION_CATEGORIES,
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  CORRECTION_TARGET_TYPES,
  type CorrectionTargetType,
} from './categories';
import { CORRECTION_PRIVACY_NOTICE } from './copy';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client';

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success'; readonly receiptCode: string; readonly statusHref: string }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly fieldIssues?: readonly { field: string; message: string }[];
    };

const DEFAULT_ERROR_MESSAGE =
  'Something went wrong submitting this correction. Please try again in a moment.';

export function CorrectionForm() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<SubmitState>({ status: 'idle' });

  const targetTypeId = useId();
  const targetRecordId = useId();
  const statementId = useId();
  const sourceUrlId = useId();
  const contactId = useId();
  const privacyId = useId();

  const initialTarget = searchParams.get('target')?.trim() ?? '';
  const initialTargetType = searchParams.get('targetType')?.trim() ?? 'entity';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      targetType: String(data.get('targetType') ?? 'entity'),
      targetRecordId: String(data.get('targetRecordId') ?? '').trim(),
      category: String(data.get('category') ?? ''),
      statement: String(data.get('statement') ?? '').trim(),
      sourceUrl: String(data.get('sourceUrl') ?? '').trim() || undefined,
      privacyConsent: data.get('privacyConsent') === 'on',
      contact: String(data.get('contact') ?? '').trim() || undefined,
    };

    setState({ status: 'submitting' });
    try {
      const integrityHeaders = await getRequestIntegrityHeaders();
      const response = await fetch('/corrections/api', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...integrityHeaders },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (response.status === 202 && body && typeof body === 'object' && 'receiptCode' in body) {
        const receiptCode = String((body as { receiptCode: unknown }).receiptCode);
        const statusHref =
          body && 'statusHref' in body
            ? String((body as { statusHref: unknown }).statusHref)
            : `/corrections/status/${encodeURIComponent(receiptCode)}`;
        setState({ status: 'success', receiptCode, statusHref });
        form.reset();
        return;
      }

      if (response.status === 429) {
        setState({
          status: 'error',
          message: 'Too many corrections from this connection. Please try again shortly.',
        });
        return;
      }

      if (response.status === 400 && body && typeof body === 'object' && 'issues' in body) {
        const issues = (body as { issues?: readonly { field: string; message: string }[] }).issues;
        setState({
          status: 'error',
          message: 'Please fix the highlighted fields and resubmit.',
          ...(issues ? { fieldIssues: issues } : {}),
        });
        return;
      }

      setState({ status: 'error', message: DEFAULT_ERROR_MESSAGE });
    } catch {
      setState({ status: 'error', message: DEFAULT_ERROR_MESSAGE });
    }
  }

  const fieldIssue = (field: string) =>
    state.status === 'error'
      ? state.fieldIssues?.find((issue) => issue.field === field)
      : undefined;

  if (state.status === 'success') {
    return (
      <div className="ds-corrections__received">
        <h2>We have it. Here is your receipt.</h2>
        <ReceiptBlock receiptCode={state.receiptCode} />
        <p className="ds-room-field__hint">
          Nothing you sent is public. If your correction is declined you get the reason, not
          silence.
        </p>
        <p className="ds-corrections__received-actions">
          <a className="ds-cta ds-cta--quiet" href={state.statusHref}>
            Check this receipt
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      className="ds-stack"
      onSubmit={handleSubmit}
      noValidate
      aria-describedby="corrections-lede"
    >
      {state.status === 'error' && !state.fieldIssues ? (
        <Notice tone="error" title="Submission failed">
          {state.message}
        </Notice>
      ) : null}
      {state.status === 'error' && state.fieldIssues ? (
        <Notice tone="error" title="Check the following">
          <ul>
            {state.fieldIssues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <Field label="What are you correcting?" htmlFor={targetTypeId}>
        <select
          id={targetTypeId}
          name="targetType"
          defaultValue={
            CORRECTION_TARGET_TYPES.includes(initialTargetType as CorrectionTargetType)
              ? initialTargetType
              : 'entity'
          }
          required
        >
          {CORRECTION_TARGET_TYPES.map((targetType) => (
            <option key={targetType} value={targetType}>
              {CORRECTION_TARGET_LABELS[targetType]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Which record is wrong?"
        htmlFor={targetRecordId}
        hint="Name the place or paste its page address. You do not need an internal id."
      >
        <input
          id={targetRecordId}
          name="targetRecordId"
          type="text"
          required
          defaultValue={initialTarget}
          placeholder="Fifteenth Street Presbyterian Church"
          aria-describedby={fieldIssue('targetRecordId') ? `${targetRecordId}-issue` : undefined}
        />
        {fieldIssue('targetRecordId') ? (
          <p id={`${targetRecordId}-issue`} className="ds-room-field__hint" role="alert">
            {fieldIssue('targetRecordId')!.message}
          </p>
        ) : null}
      </Field>

      {/* Four pills rather than a select: the set is small enough to read faster than it opens,
          and they are real radios, so the answer survives JavaScript being off. */}
      <ChoiceField
        legend="What is wrong with it?"
        name="category"
        required
        choices={CORRECTION_CATEGORIES.map((category) => ({
          value: category,
          label: CORRECTION_CATEGORY_LABELS[category],
        }))}
        {...(fieldIssue('category') ? { hint: fieldIssue('category')!.message } : {})}
      />

      <Field
        label="What should it say instead?"
        htmlFor={statementId}
        hint="Plain language is fine. You do not need to write like a citation."
      >
        <textarea
          id={statementId}
          name="statement"
          rows={5}
          required
          minLength={20}
          placeholder="The 1891 building was purpose-built, not converted."
          aria-describedby={fieldIssue('statement') ? `${statementId}-issue` : undefined}
        />
        {fieldIssue('statement') ? (
          <p id={`${statementId}-issue`} className="ds-room-field__hint" role="alert">
            {fieldIssue('statement')!.message}
          </p>
        ) : null}
      </Field>

      {/*
        The mock marks this field optional. It is not: `correction-intake.ts` rejects a submission
        with no source URL, and a label that promises otherwise would send a reader through the
        whole form to a validation error. It is stated as what it is instead — the thing that makes
        a correction reviewable rather than an assertion.
      */}
      <Field
        label={
          <>
            Where can we check it? <small>A link is what makes a correction reviewable</small>
          </>
        }
        htmlFor={sourceUrlId}
      >
        <input
          id={sourceUrlId}
          name="sourceUrl"
          type="url"
          required
          placeholder="https://"
          aria-describedby={fieldIssue('sourceUrl') ? `${sourceUrlId}-issue` : undefined}
        />
        {fieldIssue('sourceUrl') ? (
          <p id={`${sourceUrlId}-issue`} className="ds-room-field__hint" role="alert">
            {fieldIssue('sourceUrl')!.message}
          </p>
        ) : null}
      </Field>

      <Field
        label={
          <>
            Email <small>Only used to send the outcome</small>
          </>
        }
        htmlFor={contactId}
      >
        <input id={contactId} name="contact" type="text" placeholder="you@example.org" />
      </Field>

      <Notice tone="warning" title={CORRECTION_PRIVACY_NOTICE.title}>
        {CORRECTION_PRIVACY_NOTICE.body}
      </Notice>

      <div className="ds-row" style={{ alignItems: 'flex-start' }}>
        <input
          id={privacyId}
          name="privacyConsent"
          type="checkbox"
          required
          aria-describedby={fieldIssue('privacyConsent') ? `${privacyId}-issue` : undefined}
        />
        <label htmlFor={privacyId} className="ds-sans" style={{ marginLeft: 'var(--ds-space-2)' }}>
          I have read the privacy notice and understand this submission enters a restricted review
          queue. <span aria-hidden="true">*</span>
          <span className="ds-visually-hidden">required</span>
        </label>
      </div>
      {fieldIssue('privacyConsent') ? (
        <p id={`${privacyId}-issue`} className="ds-sans" role="alert">
          {fieldIssue('privacyConsent')!.message}
        </p>
      ) : null}

      <div className="ds-corrections-send">
        <Button type="submit" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Sending…' : 'Send the correction'}
        </Button>
        <span>You will get a receipt code on the next screen.</span>
      </div>
    </form>
  );
}
