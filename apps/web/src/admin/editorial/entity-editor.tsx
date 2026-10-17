'use client';
import Link from 'next/link';
import { AdminRecordPicker } from '@/components/patterns/admin-record-picker';
import { useState } from 'react';
import { Button } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Notification } from 'baseui/notification';
import { TextField, TextAreaField, ChoiceField } from '../design-system/fields';
import { useRouter } from 'next/navigation';
import { RELATIONSHIP_TYPES } from '@repo/schemas/relationship-vocabulary';
import type { EntityEditorialProposal } from '@repo/schemas';
import type { readEntityEditorial } from './entities';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { staffRoleHasPermission } from '../auth/staff-permissions';
type Details = NonNullable<Awaited<ReturnType<typeof readEntityEditorial>>>;
export function EntityEditorialEditor({
  entityId,
  details,
}: {
  entityId: string;
  details: Details;
}) {
  const { role, getIdToken } = useAdminAuth(),
    router = useRouter();
  const [proposal, setProposal] = useState<EntityEditorialProposal>({
    entityId,
    beforeHash: details.beforeHash,
    summary: details.summary,
    historicalContext: details.historicalContext,
    evidence: [{ url: '', title: '', excerpt: '' }],
    relationships: [],
  });
  const [reason, setReason] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmedProposal, setConfirmedProposal] = useState<string | null>(null);
  const [recordNames, setRecordNames] = useState<Record<string, string>>({});
  const editable = role !== null && staffRoleHasPermission(role, 'research:write'),
    reviewer = role !== null && staffRoleHasPermission(role, 'publication:publish');
  async function send(path: string, body: unknown) {
    setBusy(true);
    try {
      const token = await getIdToken();
      const response = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage('Saved. The public release is unchanged.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save. Your proposal remains in this form.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editorial-workspace" aria-label="Entity prose and evidence">
      <h2>Prose, evidence and relationships</h2>
      <p>
        Proposals remain private until a publisher reviews them. Applying a proposal updates
        canonical data for the next release.
      </p>
      <TextField
        label="Reason for proposal or review"
        value={reason}
        onChange={setReason}
        disabled={busy}
      />
      <fieldset disabled={!editable || busy}>
        <legend>Propose a revision</legend>
        <TextAreaField
          rows={3}
          label="Summary"
          value={proposal.summary}
          onChange={(summary) => setProposal({ ...proposal, summary })}
          disabled={!editable || busy}
        />
        <TextAreaField
          label="Historical context"
          rows={8}
          value={proposal.historicalContext}
          onChange={(historicalContext) => setProposal({ ...proposal, historicalContext })}
          disabled={!editable || busy}
        />
        {proposal.evidence.map((source, i) => (
          <fieldset key={i}>
            <legend>Evidence {i + 1}</legend>
            <TextField
              label="Source title"
              value={source.title}
              disabled={!editable || busy}
              onChange={(title) =>
                setProposal({
                  ...proposal,
                  evidence: proposal.evidence.map((s, j) => (j === i ? { ...s, title } : s)),
                })
              }
            />
            <TextField
              label="Source URL"
              type="url"
              value={source.url}
              disabled={!editable || busy}
              onChange={(url) =>
                setProposal({
                  ...proposal,
                  evidence: proposal.evidence.map((s, j) => (j === i ? { ...s, url } : s)),
                })
              }
            />
            <TextAreaField
              label="Evidence excerpt"
              rows={3}
              value={source.excerpt}
              disabled={!editable || busy}
              onChange={(excerpt) =>
                setProposal({
                  ...proposal,
                  evidence: proposal.evidence.map((s, j) => (j === i ? { ...s, excerpt } : s)),
                })
              }
            />
            <Button
              kind="tertiary"
              size="compact"
              disabled={
                !editable ||
                busy ||
                proposal.evidence.length === 1 ||
                proposal.relationships.some((r) => r.evidenceIndex === i)
              }
              title="Remove relationships using this source before removing it"
              onClick={() =>
                setProposal({
                  ...proposal,
                  evidence: proposal.evidence.filter((_, j) => j !== i),
                  relationships: proposal.relationships.map((r) => ({
                    ...r,
                    evidenceIndex: r.evidenceIndex > i ? r.evidenceIndex - 1 : r.evidenceIndex,
                  })),
                })
              }
            >
              Remove evidence
            </Button>
          </fieldset>
        ))}
        <Button
          kind="secondary"
          onClick={() =>
            setProposal({
              ...proposal,
              evidence: [...proposal.evidence, { url: '', title: '', excerpt: '' }],
            })
          }
        >
          Add evidence
        </Button>
        {proposal.relationships.map((relation, i) => (
          <fieldset key={i}>
            <legend>Proposed historical relationship {i + 1}</legend>
            <AdminRecordPicker
              label="Related record"
              value={
                relation.targetId
                  ? {
                      id: relation.targetId,
                      display_name: recordNames[relation.targetId] ?? relation.targetId,
                    }
                  : undefined
              }
              disabled={!editable || busy}
              onSelect={(record) => {
                setRecordNames((names) => ({ ...names, [record.id]: record.display_name }));
                setProposal({
                  ...proposal,
                  relationships: proposal.relationships.map((r, j) =>
                    j === i ? { ...r, targetId: record.id } : r,
                  ),
                });
              }}
            />
            <ChoiceField
              label="Relationship from this record to target"
              value={relation.predicate}
              disabled={!editable || busy}
              options={RELATIONSHIP_TYPES.map((id) => ({ id, label: id.replaceAll('_', ' ') }))}
              onChange={(predicate) =>
                setProposal({
                  ...proposal,
                  relationships: proposal.relationships.map((r, j) =>
                    j === i ? { ...r, predicate: predicate as typeof r.predicate } : r,
                  ),
                })
              }
            />
            <TextAreaField
              label="Exact supported statement"
              value={relation.statement}
              disabled={!editable || busy}
              onChange={(statement) =>
                setProposal({
                  ...proposal,
                  relationships: proposal.relationships.map((r, j) =>
                    j === i ? { ...r, statement } : r,
                  ),
                })
              }
            />
            <ChoiceField
              label="Supporting evidence"
              value={String(relation.evidenceIndex)}
              disabled={!editable || busy}
              options={proposal.evidence.map((_, n) => ({
                id: String(n),
                label: `Evidence ${n + 1}`,
              }))}
              onChange={(value) =>
                setProposal({
                  ...proposal,
                  relationships: proposal.relationships.map((r, j) =>
                    j === i ? { ...r, evidenceIndex: Number(value) } : r,
                  ),
                })
              }
            />
            <Button
              kind="secondary"
              onClick={() =>
                setProposal({
                  ...proposal,
                  relationships: proposal.relationships.filter((_, j) => j !== i),
                })
              }
            >
              Remove proposed relationship
            </Button>
          </fieldset>
        ))}
        <Button
          kind="secondary"
          onClick={() =>
            setProposal({
              ...proposal,
              relationships: [
                ...proposal.relationships,
                { targetId: '', predicate: 'related_to', statement: '', evidenceIndex: 0 },
              ],
            })
          }
        >
          Propose historical relationship
        </Button>
        <Button
          kind="secondary"
          onClick={() => void send('/admin/api/editorial/entities/proposals', { proposal, reason })}
        >
          Save proposal for review
        </Button>
      </fieldset>
      {message && <Notification>{message}</Notification>}
      <h3>Pending and previous proposals</h3>
      {details.proposals.length === 0 ? (
        <p>No editorial proposals.</p>
      ) : (
        details.proposals.map((item) => (
          <details key={item.id}>
            <summary>
              {item.status} · {item.payload.proposal.summary}
            </summary>
            <p>{item.payload.proposal.historicalContext}</p>
            <ul>
              {item.payload.proposal.evidence.map((e, i) => (
                <li key={i}>
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.title}
                  </a>
                  <blockquote>{e.excerpt}</blockquote>
                </li>
              ))}
            </ul>
            <ul>
              {item.payload.proposal.relationships.map((r, i) => (
                <li key={i}>
                  {r.predicate} → <Link href={`/admin/catalog/${r.targetId}`}>{r.targetId}</Link>:{' '}
                  {r.statement} (evidence {r.evidenceIndex + 1})
                </li>
              ))}
            </ul>
            {reviewer && item.status === 'quarantined' && (
              <>
                <Checkbox
                  checked={confirmedProposal === item.id}
                  disabled={busy}
                  onChange={(event) =>
                    setConfirmedProposal(event.currentTarget.checked ? item.id : null)
                  }
                >
                  I reviewed every statement, source and relationship for accuracy and dignity.
                </Checkbox>
                <Button
                  kind="secondary"
                  disabled={busy || confirmedProposal !== item.id || !reason.trim()}
                  onClick={() =>
                    void send(`/admin/api/editorial/entities/proposals/${item.id}/review`, {
                      reason,
                      confirmed: confirmedProposal === item.id,
                      decision: 'approved',
                    })
                  }
                >
                  Apply reviewed proposal to canonical
                </Button>
                <Button
                  kind="secondary"
                  disabled={busy || !reason.trim()}
                  onClick={() =>
                    void send(`/admin/api/editorial/entities/proposals/${item.id}/review`, {
                      reason,
                      decision: 'rejected',
                    })
                  }
                >
                  Reject proposal
                </Button>
              </>
            )}
          </details>
        ))
      )}
      <h3>Historical relationships held in canonical</h3>
      {details.relationships.length ? (
        <ul>
          {details.relationships.map((r) => (
            <li key={r.id}>
              {r.relationship_type} →{' '}
              <Link href={`/admin/catalog/${r.to_entity_id}`}>{r.target_name}</Link> ·{' '}
              {r.workflow_status}
            </li>
          ))}
        </ul>
      ) : (
        <p>No outgoing relationships recorded.</p>
      )}
      <h3>Stories affected by this record</h3>
      <p>Draft associations</p>
      <ul>
        {details.stories.map((a) => (
          <li key={a.slug}>
            <Link href={`/admin/stories/${a.slug}`}>{a.title}</Link> · {a.relation}
          </li>
        ))}
      </ul>
      <p>Current public associations</p>
      <ul>
        {details.published.map((a) => (
          <li key={a.slug}>
            <Link href={`/stories/${a.slug}`}>{a.title}</Link>
          </li>
        ))}
      </ul>
      <p>Story associations do not establish a historical relationship.</p>
    </section>
  );
}
