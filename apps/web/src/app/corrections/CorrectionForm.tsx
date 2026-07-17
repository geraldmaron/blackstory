'use client';

/**
 * Public correction intake form. Posts to `/corrections/api` quarantine-only, never
 * public. Supports entity/claim/source/location targets, structured categories, source URL,
 * privacy consent, and returns a receipt code on success.
 */
import { useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Notice } from '@black-book/ui';
import {
  CORRECTION_CATEGORIES,
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  CORRECTION_TARGET_TYPES,
  type CorrectionTargetType,
} from './categories';
import { CORRECTION_FORM_INTRO, CORRECTION_PRIVACY_NOTICE } from './copy';
import { getCorrectionAppCheckHeaders } from './app-check-client';

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
  const categoryId = useId();
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
      const appCheckHeaders = await getCorrectionAppCheckHeaders();
      const response = await fetch('/corrections/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appCheckHeaders },
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
    state.status === 'error' ? state.fieldIssues?.find((issue) => issue.field === field) : undefined;

  if (state.status === 'success') {
    return (
      <Notice tone="warning" title="Correction received">
        <p>
          Thank you — save your receipt code <code>{state.receiptCode}</code>. It is the only way to
          check status; we cannot look it up without it.
        </p>
        <p style={{ marginTop: 'var(--bb-space-3)' }}>
          <a className="bb-button bb-button--secondary" href={state.statusHref}>
            View status
          </a>
        </p>
      </Notice>
    );
  }

  return (
    <form className="bb-stack" onSubmit={handleSubmit} noValidate aria-describedby="correction-form-intro">
      <p id="correction-form-intro" className="bb-sans">
        {CORRECTION_FORM_INTRO}
      </p>

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

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={targetTypeId}>
          What are you correcting? <span aria-hidden="true">*</span>
          <span className="bb-visually-hidden">required</span>
        </label>
        <select
          className="bb-filters__control"
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
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={targetRecordId}>
          Record identifier <span aria-hidden="true">*</span>
          <span className="bb-visually-hidden">required</span>
        </label>
        <input
          className="bb-filters__control"
          id={targetRecordId}
          name="targetRecordId"
          type="text"
          required
          defaultValue={initialTarget}
          placeholder="Entity, claim, source, or place id from the record page"
          aria-describedby={fieldIssue('targetRecordId') ? `${targetRecordId}-issue` : undefined}
        />
        {fieldIssue('targetRecordId') ? (
          <p id={`${targetRecordId}-issue`} className="bb-sans" role="alert">
            {fieldIssue('targetRecordId')!.message}
          </p>
        ) : null}
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={categoryId}>
          Category <span aria-hidden="true">*</span>
          <span className="bb-visually-hidden">required</span>
        </label>
        <select
          className="bb-filters__control"
          id={categoryId}
          name="category"
          required
          defaultValue=""
          aria-describedby={fieldIssue('category') ? `${categoryId}-issue` : undefined}
        >
          <option value="" disabled>
            Select a category
          </option>
          {CORRECTION_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CORRECTION_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        {fieldIssue('category') ? (
          <p id={`${categoryId}-issue`} className="bb-sans" role="alert">
            {fieldIssue('category')!.message}
          </p>
        ) : null}
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={statementId}>
          Describe the correction <span aria-hidden="true">*</span>
          <span className="bb-visually-hidden">required</span>
        </label>
        <textarea
          className="bb-filters__control"
          id={statementId}
          name="statement"
          rows={5}
          required
          minLength={20}
          placeholder="What should change, and why? Cite specific facts where possible."
          aria-describedby={fieldIssue('statement') ? `${statementId}-issue` : undefined}
        />
        {fieldIssue('statement') ? (
          <p id={`${statementId}-issue`} className="bb-sans" role="alert">
            {fieldIssue('statement')!.message}
          </p>
        ) : null}
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={sourceUrlId}>
          Supporting source URL <span aria-hidden="true">*</span>
          <span className="bb-visually-hidden">required</span>
        </label>
        <input
          className="bb-filters__control"
          id={sourceUrlId}
          name="sourceUrl"
          type="url"
          required
          placeholder="https://…"
          aria-describedby={fieldIssue('sourceUrl') ? `${sourceUrlId}-issue` : undefined}
        />
        {fieldIssue('sourceUrl') ? (
          <p id={`${sourceUrlId}-issue`} className="bb-sans" role="alert">
            {fieldIssue('sourceUrl')!.message}
          </p>
        ) : null}
      </div>

      <div className="bb-stack" style={{ gap: 'var(--bb-space-2)' }}>
        <label className="bb-filters__label" htmlFor={contactId}>
          Contact (optional — moderators only, never shown publicly)
        </label>
        <input className="bb-filters__control" id={contactId} name="contact" type="text" />
      </div>

      <Notice tone="warning" title={CORRECTION_PRIVACY_NOTICE.title}>
        {CORRECTION_PRIVACY_NOTICE.body}
      </Notice>

      <div className="bb-row" style={{ alignItems: 'flex-start' }}>
        <input
          id={privacyId}
          name="privacyConsent"
          type="checkbox"
          required
          aria-describedby={fieldIssue('privacyConsent') ? `${privacyId}-issue` : undefined}
        />
        <label htmlFor={privacyId} className="bb-sans" style={{ marginLeft: 'var(--bb-space-2)' }}>
          I have read the privacy notice and understand this submission enters a restricted review
          queue. <span aria-hidden="true">*</span>
          <span className="bb-visually-hidden">required</span>
        </label>
      </div>
      {fieldIssue('privacyConsent') ? (
        <p id={`${privacyId}-issue`} className="bb-sans" role="alert">
          {fieldIssue('privacyConsent')!.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Submitting…' : 'Submit correction'}
        </Button>
      </div>
    </form>
  );
}
