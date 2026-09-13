/**
 * One submission's detail view: full payload, current status, and — while still quarantined —
 * the promote/reject/spam decision.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readVerifiedAdminIdentity } from '../../../../admin/auth/supabase-server';
import { staffRoleHasPermission } from '../../../../admin/auth/staff-permissions';
import {
  findResearchCaseIdForSubmission,
  getIntakeItemDetail,
  SUBMISSION_DECISION_PERMISSION,
} from '../../../../admin/lib/postgres-submissions';
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
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
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

  const linkedCaseId =
    submission.status !== 'quarantined' ? await findResearchCaseIdForSubmission(id) : null;

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-page__header">
        <p className="ds-page__eyebrow">Intake</p>
        <h1 className="ds-page__title">{submission.title}</h1>
        <p className="ds-page__lede">
          <span className="story-review__badge">{titleCase(submission.status)}</span>
          {' · '}
          {submission.kind ? titleCase(submission.kind) : 'Unspecified kind'}
          {' · '}
          Submitted {formatWhen(submission.createdAt)}
        </p>
        <p className="story-review__notice">
          <Link href="/admin/submissions">Back to submissions</Link>
        </p>
      </header>

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

      {submission.status === 'quarantined' ? (
        canDecide ? (
          <section aria-label="Decide this submission">
            <SubmissionDecisionForm intakeItemId={submission.id} />
          </section>
        ) : (
          <p className="story-review__notice" role="status">
            Your role cannot decide submissions. This needs {SUBMISSION_DECISION_PERMISSION}.
          </p>
        )
      ) : (
        <p className="story-review__notice" role="status">
          Already decided: {titleCase(submission.status)}.
        </p>
      )}
    </main>
  );
}
