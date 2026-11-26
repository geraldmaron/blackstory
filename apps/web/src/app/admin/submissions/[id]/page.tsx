/**
 * One submission's detail view: full payload, current status, and — while still quarantined —
 * the promote/reject/spam decision.
 */
import Link from 'next/link';
import { DeskTitleBar } from '../../../../admin/design-system/ui';
import { notFound } from 'next/navigation';
import { readVerifiedAdminIdentity } from '../../../../admin/auth/supabase-server';
import { staffRoleHasPermission } from '../../../../admin/auth/staff-permissions';
import {
  findResearchCaseIdForSubmission,
  getIntakeItemDetail,
  SUBMISSION_DECISION_PERMISSION,
  submissionDecisionOptions,
  submissionHasReceipt,
  submissionOutcomeEmailsSubmitter,
  submissionWorkRequest,
  type SubmissionDecision,
} from '../../../../admin/lib/postgres-submissions';
import { HandToAgentButton } from './HandToAgentButton';
import { SubmissionDecisionForm } from './SubmissionDecisionForm';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  /** `do` comes from the quick links in the owner alert email: it only preselects, never acts. */
  readonly searchParams: Promise<{ readonly do?: string }>;
}) {
  const [{ id }, { do: quick }] = await Promise.all([params, searchParams]);
  const [submission, identity] = await Promise.all([
    getIntakeItemDetail(id),
    readVerifiedAdminIdentity(),
  ]);

  if (!submission) {
    notFound();
  }

  const canDecide = identity
    ? staffRoleHasPermission(identity.role, SUBMISSION_DECISION_PERMISSION)
    : false;

  const decisions = submissionDecisionOptions(submission);
  const payload = submission.payload as Record<string, unknown> | null;
  const closure = payload?.closureReason;
  const displayStatus = closure === 'resolved' ? 'resolved' : submission.status;
  const linkedCaseId =
    submission.status !== 'quarantined' ? await findResearchCaseIdForSubmission(id) : null;

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Intake"
        title={submission.title}
        description={
          <>
            <span className="story-review__badge">{titleCase(displayStatus)}</span>
            {' · '}
            {submission.kind ? titleCase(submission.kind) : 'Unspecified kind'}
            {' · '}
            Submitted {formatWhen(submission.createdAt)}
          </>
        }
      />
      <p className="story-review__notice">
        <Link href="/admin/submissions">Back to submissions</Link>
      </p>

      <section className="story-review__detail" aria-label="Submission detail">
        <p className="story-review__detail-meta ds-mono">
          {submission.id} · submitted by {submission.createdBy}
        </p>
        {submission.sourceUrl ? (
          <p className="ds-sans">
            Source:{' '}
            <a href={submission.sourceUrl} rel="noopener noreferrer" target="_blank">
              {submission.sourceUrl}
            </a>
          </p>
        ) : null}
        {linkedCaseId ? (
          <p className="ds-sans">
            Research case: <Link href={`/admin/cases/${linkedCaseId}`}>{linkedCaseId}</Link>
          </p>
        ) : null}

        <details>
          <summary>Raw payload</summary>
          <pre className="ds-mono story-review__row-meta" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(submission.payload, null, 2)}
          </pre>
        </details>
      </section>

      {decisions.length > 0 ? (
        canDecide ? (
          <section aria-label="Decide this submission">
            <SubmissionDecisionForm
              key={decisions.join(',')}
              intakeItemId={submission.id}
              title={submission.title}
              emailsSubmitter={submissionOutcomeEmailsSubmitter(submission)}
              decisions={decisions}
              needsPublicReason={decisions.includes('reject') && submissionHasReceipt(submission)}
              {...(decisions.includes(quick as SubmissionDecision)
                ? { initialDecision: quick as SubmissionDecision }
                : {})}
            />
            {submission.status === 'quarantined' ? (
              <HandToAgentButton
                intakeItemId={submission.id}
                request={submissionWorkRequest(submission)}
                focusOnLoad={quick === 'agent'}
              />
            ) : null}
          </section>
        ) : (
          <p className="story-review__notice" role="status">
            Your role cannot decide submissions. This needs {SUBMISSION_DECISION_PERMISSION}.
          </p>
        )
      ) : (
        <p className="story-review__notice" role="status">
          Already decided: {titleCase(displayStatus)}.
        </p>
      )}
    </main>
  );
}
