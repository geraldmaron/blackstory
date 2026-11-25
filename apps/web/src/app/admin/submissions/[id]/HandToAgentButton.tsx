'use client';

/**
 * Hands one submission to the agent work queue (/admin/work). Session mode only: the request
 * waits until a Claude or Codex session picks it up through the management MCP, so this never
 * starts paid background work. The key is per submission, so a second press returns the same
 * request instead of queuing another.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '../../../../admin/auth/AdminAuthProvider';
import { FormButton } from '../../../../admin/design-system/fields';

export function HandToAgentButton({
  intakeItemId,
  request,
  focusOnLoad = false,
}: {
  readonly intakeItemId: string;
  /** Built server-side by `submissionWorkRequest`. */
  readonly request: string;
  readonly focusOnLoad?: boolean;
}) {
  const { getIdToken } = useAdminAuth();
  const [state, setState] = useState<
    | { status: 'idle' | 'working' }
    | { status: 'queued'; reviewUrl: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusOnLoad) return;
    sectionRef.current?.scrollIntoView({ block: 'center' });
    sectionRef.current?.querySelector('button')?.focus();
  }, [focusOnLoad]);

  async function handOff() {
    setState({ status: 'working' });
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Sign in again to hand this off.');
      const response = await fetch('/admin/api/work', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          idempotencyKey: `intake:${intakeItemId}`,
          sessionId: 'admin-intake',
          harness: 'admin',
          executionMode: 'session',
        }),
      });
      const result = (await response.json()) as { error?: string; reviewUrl?: string };
      if (!response.ok || !result.reviewUrl) throw new Error(result.error || 'Could not queue it.');
      setState({ status: 'queued', reviewUrl: result.reviewUrl });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not queue it.',
      });
    }
  }

  return (
    <section aria-label="Hand to an agent" ref={sectionRef} className="story-review__notice">
      {state.status === 'queued' ? (
        <p role="status">
          Queued for an agent. The next Claude or Codex session that checks the work queue picks it
          up, and you’ll get an email when its proposal is ready.{' '}
          <Link href={state.reviewUrl}>Open the request</Link>
        </p>
      ) : (
        <>
          <p>
            Not sure yet? Hand it to an agent to research. It comes back as a proposal for you to
            approve, and this submission stays open until you decide it.
          </p>
          {state.status === 'error' ? (
            <p className="ds-notice ds-notice--error" role="alert">
              {state.message}
            </p>
          ) : null}
          <FormButton
            type="button"
            className="ds-button ds-button--secondary"
            disabled={state.status === 'working'}
            onClick={handOff}
          >
            {state.status === 'working' ? 'Working…' : 'Hand to an agent'}
          </FormButton>
        </>
      )}
    </section>
  );
}
