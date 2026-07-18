'use client';

/**
 * appeal form for rejected corrections or disputed classifications. Posts to
 * `/corrections/appeal/api` and never exposes moderation-sensitive details.
 */
import { useId, useState, type FormEvent } from 'react';
import { Button, Notice } from '@repo/ui';
import { APPEAL_ELIGIBILITY_NOTICE, CORRECTION_PRIVACY_NOTICE } from './copy';
import { getCorrectionAppCheckHeaders } from './app-check-client';

type AppealState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'success'; readonly receiptCode: string }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly fieldIssues?: readonly { field: string; message: string }[];
    };

export function AppealForm({ receiptCode }: { readonly receiptCode?: string | undefined }) {
  const [state, setState] = useState<AppealState>({ status: 'idle' });
  const receiptId = useId();
  const statementId = useId();
  const sourceUrlId = useId();
  const contactId = useId();
  const privacyId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      receiptCode: String(data.get('receiptCode') ?? '').trim(),
      statement: String(data.get('statement') ?? '').trim(),
      sourceUrl: String(data.get('sourceUrl') ?? '').trim() || undefined,
      privacyConsent: data.get('privacyConsent') === 'on',
      contact: String(data.get('contact') ?? '').trim() || undefined,
    };

    setState({ status: 'submitting' });
    try {
      const appCheckHeaders = await getCorrectionAppCheckHeaders();
      const response = await fetch('/corrections/appeal/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appCheckHeaders },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (response.status === 202) {
        setState({
          status: 'success',
          receiptCode:
            body && typeof body === 'object' && 'receiptCode' in body
              ? String((body as { receiptCode: unknown }).receiptCode)
              : payload.receiptCode,
        });
        form.reset();
        return;
      }

      if (response.status === 403) {
        setState({
          status: 'error',
          message: 'An appeal is not available for this receipt code right now.',
        });
        return;
      }

      if (response.status === 404) {
        setState({ status: 'error', message: 'No correction matches that receipt code.' });
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

      setState({ status: 'error', message: 'Something went wrong submitting your appeal.' });
    } catch {
      setState({ status: 'error', message: 'Something went wrong submitting your appeal.' });
    }
  }

  const fieldIssue = (field: string) =>
    state.status === 'error' ? state.fieldIssues?.find((issue) => issue.field === field) : undefined;

  if (state.status === 'success') {
    return (
      <Notice tone="warning" title="Appeal received">
        Your appeal for receipt <code>{state.receiptCode}</code> has re-entered review. Check the
        same receipt’s status page for updates — we never publish moderation details.
      </Notice>
    );
  }

  return (
    <form className="ds-stack" onSubmit={handleSubmit} noValidate>
      <p className="ds-sans">{APPEAL_ELIGIBILITY_NOTICE}</p>

      {state.status === 'error' ? (
        <Notice tone="error" title="Appeal failed">
          {state.message}
          {state.fieldIssues ? (
            <ul>
              {state.fieldIssues.map((issue) => (
                <li key={issue.field}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      <div className="ds-stack" style={{ gap: 'var(--ds-space-2)' }}>
        <label className="ds-filters__label" htmlFor={receiptId}>
          Receipt code <span aria-hidden="true">*</span>
        </label>
        <input
          className="ds-filters__control"
          id={receiptId}
          name="receiptCode"
          type="text"
          required
          defaultValue={receiptCode ?? ''}
          readOnly={Boolean(receiptCode)}
          aria-readonly={Boolean(receiptCode)}
        />
      </div>

      <div className="ds-stack" style={{ gap: 'var(--ds-space-2)' }}>
        <label className="ds-filters__label" htmlFor={statementId}>
          Why are you appealing? <span aria-hidden="true">*</span>
        </label>
        <textarea
          className="ds-filters__control"
          id={statementId}
          name="statement"
          rows={4}
          required
          minLength={20}
        />
        {fieldIssue('statement') ? (
          <p className="ds-sans" role="alert">
            {fieldIssue('statement')!.message}
          </p>
        ) : null}
      </div>

      <div className="ds-stack" style={{ gap: 'var(--ds-space-2)' }}>
        <label className="ds-filters__label" htmlFor={sourceUrlId}>
          Supporting HTTPS link <span aria-hidden="true">*</span>
        </label>
        <input className="ds-filters__control" id={sourceUrlId} name="sourceUrl" type="url" required />
        {fieldIssue('sourceUrl') ? (
          <p className="ds-sans" role="alert">
            {fieldIssue('sourceUrl')!.message}
          </p>
        ) : null}
      </div>

      <div className="ds-stack" style={{ gap: 'var(--ds-space-2)' }}>
        <label className="ds-filters__label" htmlFor={contactId}>
          Contact (optional)
        </label>
        <input className="ds-filters__control" id={contactId} name="contact" type="text" />
      </div>

      <Notice tone="warning" title={CORRECTION_PRIVACY_NOTICE.title}>
        {CORRECTION_PRIVACY_NOTICE.body}
      </Notice>

      <div className="ds-row" style={{ alignItems: 'flex-start' }}>
        <input id={privacyId} name="privacyConsent" type="checkbox" required />
        <label htmlFor={privacyId} className="ds-sans" style={{ marginLeft: 'var(--ds-space-2)' }}>
          I confirm the privacy notice. <span aria-hidden="true">*</span>
        </label>
      </div>

      <Button type="submit" disabled={state.status === 'submitting'}>
        {state.status === 'submitting' ? 'Submitting…' : 'Submit appeal'}
      </Button>
    </form>
  );
}
