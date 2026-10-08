'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { WorkItem } from '@repo/ops-data/management/contracts';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { staffRoleHasPermission } from '../auth/staff-permissions';
import './work-inbox.css';

const labels: Record<WorkItem['state'], string> = {
  queued: 'Waiting to start',
  researching: 'Researching',
  awaiting_review: 'Ready for your review',
  approved: 'Approved',
  publishing: 'Publishing',
  published: 'Published and verified',
  held: 'On hold',
  failed: 'Needs attention',
  verification_failed: 'Publication needs verification',
};
export function WorkInbox({ workId }: { workId?: string }) {
  const { getIdToken, role } = useAdminAuth();
  const canPublish = !!role && staffRoleHasPermission(role, 'publication:publish');
  const canResearch = !!role && staffRoleHasPermission(role, 'research:write');
  const [items, setItems] = useState<WorkItem[]>([]);
  const [request, setRequest] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const decisionKey = useRef<{ body: string; key: string } | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const api = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getIdToken();
      if (!token) throw new Error('Sign in to manage requests.');
      const response = await fetch(`/admin/api/work${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed. Please retry.');
      return result;
    },
    [getIdToken],
  );
  const refresh = useCallback(async () => {
    try {
      const result = await api(workId ? `/${workId}` : '');
      setItems(workId ? [result.work] : result.items);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load requests.');
    }
  }, [api, workId]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  const work = workId ? items[0] : undefined;
  const interrupted =
    work &&
    ['queued', 'researching', 'approved', 'publishing'].includes(work.state) &&
    Date.now() - Date.parse(work.updatedAt) > 120000 &&
    (!work.leaseExpiresAt || Date.parse(work.leaseExpiresAt) < Date.now());
  useEffect(() => {
    setSelected(
      work?.proposal?.changes
        .filter(
          (c) =>
            !c.blockers.length &&
            !work.approvedEntityIds.includes(c.entityId) &&
            !(
              Array.isArray(work.outcome?.publishedEntityIds) &&
              work.outcome.publishedEntityIds.includes(c.entityId)
            ),
        )
        .map((c) => c.entityId) ?? [],
    );
  }, [work?.id, work?.version, work?.state]);
  async function submit() {
    setBusy(true);
    setError(null);
    const key = requestKey ?? crypto.randomUUID();
    setRequestKey(key);
    try {
      const result = await api('', {
        request,
        idempotencyKey: key,
        sessionId: 'admin-inbox',
        harness: 'admin_console',
      });
      window.location.assign(result.reviewUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your request.');
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: 'approve' | 'hold' | 'request_changes') {
    if (!work?.proposalHash) return;
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify({ action, selected, reason, version: work.version });
      if (decisionKey.current?.body !== body)
        decisionKey.current = { body, key: crypto.randomUUID() };
      await api(`/${work.id}/decisions`, {
        version: work.version,
        proposalHash: work.proposalHash,
        action,
        entityIds: selected,
        reason:
          reason.trim() ||
          (action === 'approve'
            ? 'Approve and publish the selected changes.'
            : 'Hold the selected changes.'),
        sessionId: 'admin-inbox',
        idempotencyKey: decisionKey.current.key,
      });
      setReason('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="ds-container ds-page work-inbox">
      <header>
        <h1>{workId ? 'Review request' : 'Requests'}</h1>
        <p>Describe what you want changed. Review the proposed result, then approve publication.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {!workId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="work-request">What would you like done?</label>
          <textarea
            id="work-request"
            value={request}
            maxLength={12000}
            rows={5}
            onChange={(e) => {
              setRequest(e.target.value);
              setRequestKey(null);
            }}
            required
          />
          <button
            className="ds-button"
            type="submit"
            disabled={busy || !request.trim() || !canResearch}
          >
            {busy ? 'Saving request…' : 'Send request'}
          </button>
        </form>
      )}
      {!loaded && !error && <p role="status">Loading requests…</p>}
      {loaded && !items.length && <p>No requests yet.</p>}
      {!workId &&
        items.map((item) => (
          <article key={item.id}>
            <h2>
              <Link href={`/admin/work/${item.id}`}>{item.request.request}</Link>
            </h2>
            <p>{labels[item.state]}</p>
            {item.error && <p>{item.error}</p>}
          </article>
        ))}
      {work && (
        <>
          <Link href="/admin/work">All requests</Link>
          <article>
            <h2>{work.request.request}</h2>
            <p role="status">{labels[work.state]}</p>
            {(work.error || interrupted) && (
              <>
                <p role="alert">
                  {work.error ||
                    'No worker is currently running this request. You can retry it here.'}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void api(`/${work.id}/retry`, {})
                      .then(refresh)
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Retry
                </button>
              </>
            )}
            {work.proposal && (
              <>
                <p>{work.proposal.interpretation}</p>
                <p>{work.proposal.summary}</p>
                {work.proposal.changes.map((change) => (
                  <section key={change.entityId} className="work-inbox__change">
                    <h3>{change.record.displayName}</h3>
                    <p>
                      {change.operation === 'create' ? 'New record' : 'Record update'}
                      {work.approvedEntityIds.includes(change.entityId) ? ' · Approved' : ''}
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(change.entityId)}
                        disabled={
                          busy ||
                          (Array.isArray(work.outcome?.publishedEntityIds) &&
                            work.outcome.publishedEntityIds.includes(change.entityId)) ||
                          !['awaiting_review', 'held', 'approved'].includes(work.state)
                        }
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked
                              ? [...ids, change.entityId]
                              : ids.filter((id) => id !== change.entityId),
                          )
                        }
                      />{' '}
                      Select this change
                    </label>
                    {change.before && (
                      <details>
                        <summary>Current record</summary>
                        <p>{change.before.displayName}</p>
                        <p>{change.before.summary || 'No summary recorded.'}</p>
                        {change.before.historicalContext && (
                          <p>{change.before.historicalContext}</p>
                        )}
                        {change.before.locations?.map((location) => (
                          <p key={location.id}>
                            {location.label}: {location.lat ?? 'unlocated'},{' '}
                            {location.lng ?? 'unlocated'} ({location.precision})
                          </p>
                        ))}
                      </details>
                    )}
                    <h4>Proposed record</h4>
                    <p className="work-inbox__preview">{change.record.summary}</p>
                    {change.contextRevision && (
                      <section>
                        <h4>Historical context correction</h4>
                        <p>{change.contextRevision.reason}</p>
                        <p>
                          {change.contextRevision.text || 'Remove the current historical context.'}
                        </p>
                      </section>
                    )}
                    {change.claimRevisions?.map((revision) => (
                      <section key={revision.claimId}>
                        <h4>Replace an existing assertion</h4>
                        <blockquote>
                          {change.before?.claims?.find((claim) => claim.id === revision.claimId)
                            ?.statement ?? revision.claimId}
                        </blockquote>
                        <p>{revision.reason}</p>
                        {revision.replacementAssertionIds.map((id) => (
                          <p key={id}>
                            {change.assertions.find((claim) => claim.id === id)?.statement}
                          </p>
                        ))}
                      </section>
                    ))}
                    {change.locationRevision && (
                      <section>
                        <h4>Map location correction</h4>
                        <p>{change.locationRevision.reason}</p>
                        <p>
                          {change.record.location
                            ? `Replace with ${change.record.location.label} (${change.record.location.precision}).`
                            : 'Remove the map point until the location can be supported.'}
                        </p>
                      </section>
                    )}
                    <p>
                      {change.record.jurisdiction}.{' '}
                      {change.record.location
                        ? `Map location: ${change.record.location.label} (${change.record.location.precision}).`
                        : 'No map point proposed.'}
                    </p>
                    <p>
                      Topics: {change.record.topicTags.join(', ') || 'None proposed'}. Periods:{' '}
                      {change.record.eraBuckets.join(', ') || 'None proposed'}.
                    </p>
                    {change.omissions.length > 0 && (
                      <>
                        <h4>Left out</h4>
                        <ul>
                          {change.omissions.map((text, i) => (
                            <li key={i}>{text}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {change.blockers.length > 0 && (
                      <>
                        <h4>Needs resolution</h4>
                        <ul>
                          {change.blockers.map((text, i) => (
                            <li key={i}>{text}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <details>
                      <summary>Evidence and review</summary>
                      <p>{change.identityReview}</p>
                      <p>
                        {change.reviewBasis === 'self_review'
                          ? 'Author self-review'
                          : 'Separate reviewer'}
                        : {change.proseReview}
                      </p>
                      {change.assertions.map((assertion) => (
                        <section key={assertion.id}>
                          <h4>{assertion.statement}</h4>
                          <p>
                            {assertion.finding}: {assertion.reasoning}
                          </p>
                          {assertion.evidence.map((source, i) => (
                            <div key={i}>
                              <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                                {source.title}
                              </a>
                              <p>{source.locator}</p>
                              <blockquote>{source.quote}</blockquote>
                              <p>{source.fitnessReason}</p>
                            </div>
                          ))}
                          <p>Counterevidence: {assertion.counterevidenceSearch}</p>
                        </section>
                      ))}
                    </details>
                  </section>
                ))}
                {work.proposal.held.map((held, i) => (
                  <p key={i}>
                    Held: {held.subject}. {held.reason}
                  </p>
                ))}
                {['awaiting_review', 'held', 'approved'].includes(work.state) && (
                  <div className="work-inbox__decision">
                    <label htmlFor="work-feedback">Changes or review notes</label>
                    <textarea
                      id="work-feedback"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="work-inbox__actions">
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !selected.length ||
                          !canPublish ||
                          work.proposal.changes.some(
                            (change) =>
                              selected.includes(change.entityId) && change.blockers.length > 0,
                          )
                        }
                        onClick={() => void decide('approve')}
                      >
                        Approve and publish selected
                      </button>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          (!selected.length && !!work.proposal.changes.length) ||
                          !reason.trim()
                        }
                        onClick={() => void decide('request_changes')}
                      >
                        Request changes
                      </button>
                      <button
                        type="button"
                        disabled={busy || (!selected.length && !!work.proposal.changes.length)}
                        onClick={() => void decide('hold')}
                      >
                        Hold selected
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {work.outcome && (
              <section aria-label="Publication result">
                <h3>Publication result</h3>
                <p>
                  {work.outcome.verified === true
                    ? 'Selected changes are published and verified.'
                    : 'Publication has not yet been verified.'}
                </p>
                {Array.isArray(work.outcome.links) && (
                  <ul>
                    {work.outcome.links.map((raw: unknown) => {
                      const link = raw as { entityId: string; title: string };
                      return (
                        <li key={link.entityId}>
                          <a
                            href={`https://blackstory.app/entity/${encodeURIComponent(link.entityId)}`}
                          >
                            {link.title}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {Array.isArray(work.outcome.heldEntityIds) &&
                  work.outcome.heldEntityIds.length > 0 && (
                    <p>{work.outcome.heldEntityIds.length} changes remain unpublished.</p>
                  )}
              </section>
            )}
          </article>
        </>
      )}
    </main>
  );
}
