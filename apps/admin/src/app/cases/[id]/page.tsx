/**
 * Full-page research case detail with the same live decision actions as the queue sheet.
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../auth/AdminAuthProvider';
import { actionLabel, formatWhen } from '../../../cases/case-queue';
import type { ResearchCaseReasonCode } from '@repo/domain';
import {
  EXCLUSION_REASON_CODES,
  legalActionsForState,
  stateLabel,
  type AdminCaseDetail,
  type AdminCaseTransitionAction,
} from '../../../cases/research-case-types';
import '../../../cases/case-queue.css';

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const { getIdToken, user } = useAdminAuth();
  const [detail, setDetail] = useState<AdminCaseDetail | null>(null);
  const [legalActions, setLegalActions] = useState<readonly AdminCaseTransitionAction[]>([]);
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<ResearchCaseReasonCode>(
    EXCLUSION_REASON_CODES[0] ?? 'outside_scope',
  );
  const [mergeTarget, setMergeTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const response = await fetch(`/api/research-cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        item?: AdminCaseDetail;
        legalActions?: AdminCaseTransitionAction[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? `Load failed (${response.status})`);
      setDetail(body.item ?? null);
      setLegalActions(
        body.legalActions ?? (body.item ? legalActionsForState(body.item.state) : []),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [caseId, getIdToken]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function runTransition(action: AdminCaseTransitionAction) {
    if (!caseId || !reason.trim()) {
      setError('A durable operator reason is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }
      const response = await fetch(`/api/research-cases/${caseId}/transition`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason: reason.trim(),
          ...(action === 'exclude' ? { reasonCode } : {}),
          ...(action === 'merge' && mergeTarget.trim()
            ? { mergedIntoCaseId: mergeTarget.trim() }
            : {}),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Transition failed (${response.status})`);
      setStatus(`${actionLabel(action)} recorded`);
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ds-container ds-page acq" id="main">
      <p className="acq__eyebrow">
        <Link href="/cases">Cases</Link> / detail
      </p>
      <h1 className="acq__title">{detail?.title ?? caseId}</h1>
      {error ? (
        <p className="acq__alert" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="acq__notice" role="status">
          {status}
        </p>
      ) : null}

      {!detail ? (
        <p>Loading…</p>
      ) : (
        <>
          <p>
            <span className="acq__badge">{stateLabel(detail.state)}</span>
          </p>
          <dl className="acq-sheet__dl">
            <div>
              <dt>Case id</dt>
              <dd className="acq__mono">{detail.id}</dd>
            </div>
            <div>
              <dt>Candidate</dt>
              <dd className="acq__mono">{detail.candidateId}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatWhen(detail.updatedAt)}</dd>
            </div>
            {detail.placeHint ? (
              <div>
                <dt>Place</dt>
                <dd>{detail.placeHint}</dd>
              </div>
            ) : null}
          </dl>

          <section>
            <h2>Evidence checklist</h2>
            {detail.checklist.items.length === 0 ? (
              <p>No checklist items yet.</p>
            ) : (
              <ul>
                {detail.checklist.items.map((item) => (
                  <li key={item.key}>
                    {item.complete ? 'Done' : 'Open'} · {item.key}
                    {item.note ? ` — ${item.note}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>History</h2>
            {detail.history.length === 0 ? (
              <p>No transitions yet.</p>
            ) : (
              <ol>
                {[...detail.history].reverse().map((event, index) => (
                  <li key={`${event.occurredAt}-${index}`}>
                    {event.from} → {event.to}: {event.reason} ({formatWhen(event.occurredAt)})
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="acq__bulk">
            <label className="acq__field acq__field--grow">
              <span>Operator reason</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {legalActions.includes('exclude') ? (
              <label className="acq__field">
                <span>Exclude reason code</span>
                <select
                  value={reasonCode}
                  onChange={(event) =>
                    setReasonCode(event.target.value as ResearchCaseReasonCode)
                  }
                >
                  {EXCLUSION_REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {legalActions.includes('merge') ? (
              <label className="acq__field acq__field--grow">
                <span>Merge into case id</span>
                <input
                  type="text"
                  value={mergeTarget}
                  onChange={(event) => setMergeTarget(event.target.value)}
                />
              </label>
            ) : null}
            <div className="acq__bulk-actions">
              {legalActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="acq__button acq__button--primary"
                  disabled={busy}
                  onClick={() => void runTransition(action)}
                >
                  {actionLabel(action)}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
