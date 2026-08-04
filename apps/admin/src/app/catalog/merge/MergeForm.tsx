'use client';

/**
 * Choosing a survivor and confirming a merge.
 *
 * The survivor is a radio, not a dropdown, because the weight of each record — claims,
 * relationships, identifiers — has to be visible next to the choice. Picking the wrong survivor is
 * the expensive mistake here, and it is not recoverable by editing afterwards; it needs an
 * un-merge.
 */
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { mergeEntities } from './actions';
import { MERGE_INITIAL } from './merge-state';
import type { MergeCandidate } from '../../../lib/entity-merge';

function weight(candidate: MergeCandidate): string {
  return [
    `${candidate.claimCount} claims`,
    `${candidate.relationshipCount} relationships`,
    `${candidate.identifierCount} identifiers`,
    `${candidate.locationCount} locations`,
  ].join(' · ');
}

export function MergeForm({
  candidates,
  defaultSurvivorId,
}: {
  readonly candidates: readonly MergeCandidate[];
  readonly defaultSurvivorId: string;
}) {
  const [state, formAction, pending] = useActionState(mergeEntities, MERGE_INITIAL);
  const [survivorId, setSurvivorId] = useState(defaultSurvivorId);
  const [reason, setReason] = useState('');

  if (state.status === 'ok') {
    return (
      <div className="entity-merge__done">
        <p className="story-review__notice" role="status">
          {state.message}
        </p>
        <p>
          <Link href={`/catalog/${encodeURIComponent(state.survivorId ?? survivorId)}`}>
            Open the surviving record →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="entity-merge__form">
      {candidates.map((candidate) => (
        <input key={candidate.id} type="hidden" name="candidateId" value={candidate.id} />
      ))}

      <fieldset className="entity-merge__choices">
        <legend>Which record survives?</legend>
        {candidates.map((candidate) => (
          <label key={candidate.id} className="entity-merge__choice">
            <input
              type="radio"
              name="survivorId"
              value={candidate.id}
              checked={survivorId === candidate.id}
              onChange={() => setSurvivorId(candidate.id)}
              disabled={Boolean(candidate.absorbedBy)}
            />
            <span>
              <strong>{candidate.displayName}</strong>
              <span className="ds-mono entity-merge__choice-id">
                {candidate.id} · {candidate.kind}
              </span>
              <span className="entity-edit__hint">{weight(candidate)}</span>
              {candidate.absorbedBy ? (
                <span className="entity-edit__error">
                  Already absorbed by {candidate.absorbedBy} — it cannot survive or be merged again.
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="story-review__field">
        <span>Reason for this merge</span>
        <input
          type="text"
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What shows these are the same thing?"
          required
        />
      </label>

      {state.status === 'error' ? (
        <p className="entity-edit__error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="entity-edit__actions">
        <button type="submit" className="ds-button" disabled={pending || !reason.trim()}>
          {pending ? 'Merging…' : `Merge ${candidates.length - 1} into this record`}
        </button>
        <Link href="/catalog" className="entity-merge__cancel">
          Cancel
        </Link>
      </div>
    </form>
  );
}
