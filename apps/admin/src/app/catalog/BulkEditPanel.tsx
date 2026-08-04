'use client';

/**
 * Bulk field edits on the current selection.
 *
 * The confirm step names the exact count and the exact change, because "apply to everything
 * matching this filter" is the one action here where the operator cannot see what they are about
 * to touch. Above `BULK_CONFIRM_THRESHOLD` it takes a second, deliberate click rather than one.
 */
import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyBulkEdit } from './bulk-actions';
import { BULK_EDIT_INITIAL } from './bulk-state';
import { BULK_CONFIRM_THRESHOLD, describeBulkEdit } from '../../lib/entity-bulk-edit';
import { ENTITY_KINDS, LIVING_STATUSES, entityClassForKind } from '../../lib/entity-vocabulary';
import type { EntityKind } from '../../lib/entity-vocabulary';
import { formatLivingStatusLabel } from './living-status-label';

type Field = 'kind' | 'livingStatus' | 'sensitivity';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

export function BulkEditPanel({
  selectedIds,
  sensitivityClasses,
}: {
  readonly selectedIds: ReadonlySet<string>;
  readonly sensitivityClasses: readonly string[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(applyBulkEdit, BULK_EDIT_INITIAL);
  const [field, setField] = useState<Field>('kind');
  const [value, setValue] = useState<string>(ENTITY_KINDS[0]);
  const [classes, setClasses] = useState<readonly string[]>([]);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const count = selectedIds.size;
  const needsConfirm = count >= BULK_CONFIRM_THRESHOLD;

  // Mirrors what the server will derive, so the confirm line says what will actually happen.
  const preview =
    field === 'kind'
      ? describeBulkEdit({
          field: 'kind',
          kind: value as EntityKind,
          entityClass: entityClassForKind(value as EntityKind),
        })
      : field === 'livingStatus'
        ? describeBulkEdit({ field: 'livingStatus', livingStatus: value as never })
        : describeBulkEdit({ field: 'sensitivity', classes });

  if (state.status === 'applied') {
    return (
      <div className="entity-bulk">
        <p className="story-review__notice" role="status">
          {state.message}
        </p>
        <button
          type="button"
          className="ds-button ds-button--secondary"
          onClick={() => {
            setConfirming(false);
            // Re-render the server component so the rows show their new values.
            router.refresh();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="entity-bulk">
      <input type="hidden" name="entityIds" value={[...selectedIds].join(',')} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={field === 'sensitivity' ? '' : value} />
      {classes.map((entry) => (
        <input key={entry} type="hidden" name="sensitivity" value={entry} />
      ))}

      <label className="story-review__field">
        <span>Change</span>
        <select
          value={field}
          onChange={(event) => {
            const next = event.target.value as Field;
            setField(next);
            setConfirming(false);
            setValue(
              next === 'kind' ? ENTITY_KINDS[0] : next === 'livingStatus' ? LIVING_STATUSES[0] : '',
            );
          }}
        >
          <option value="kind">Kind</option>
          <option value="livingStatus">Living status</option>
          <option value="sensitivity">Sensitivity</option>
        </select>
      </label>

      {field === 'kind' ? (
        <label className="story-review__field">
          <span>To</span>
          <select
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setConfirming(false);
            }}
          >
            {ENTITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {titleCase(kind)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {field === 'livingStatus' ? (
        <label className="story-review__field">
          <span>To</span>
          <select
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setConfirming(false);
            }}
          >
            {LIVING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLivingStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {field === 'sensitivity' ? (
        <fieldset className="entity-edit__checks">
          <legend>To</legend>
          {sensitivityClasses.map((sensitivityClass) => (
            <label key={sensitivityClass} className="entity-edit__check">
              <input
                type="checkbox"
                checked={classes.includes(sensitivityClass)}
                onChange={(event) => {
                  setClasses((current) =>
                    event.target.checked
                      ? [...current, sensitivityClass]
                      : current.filter((entry) => entry !== sensitivityClass),
                  );
                  setConfirming(false);
                }}
              />
              <span>{titleCase(sensitivityClass)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="story-review__field">
        <span className="ds-visually-hidden">Reason (required, audited)</span>
        <input
          type="text"
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (required, audited)"
          required
        />
      </label>

      {confirming || !needsConfirm ? (
        <button type="submit" className="ds-button" disabled={pending || !reason.trim()}>
          {pending
            ? 'Applying…'
            : `Set ${preview} on ${count.toLocaleString()} record${count === 1 ? '' : 's'}`}
        </button>
      ) : (
        <button
          type="button"
          className="ds-button"
          disabled={!reason.trim()}
          onClick={() => setConfirming(true)}
        >
          Review {count.toLocaleString()} records…
        </button>
      )}

      {confirming && needsConfirm ? (
        <p className="entity-bulk__confirm" role="status">
          This sets {preview} on {count.toLocaleString()} records in one audited change. Absorbed
          records are skipped.
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p className="entity-edit__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
