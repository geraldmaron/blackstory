'use client';

/**
 * The editable half of the entity record.
 *
 * The reason is collected once at the top and carried into every field's form. Every canonical
 * write requires one — an edit with no stated justification is refused server-side — and asking
 * for it seven times would train operators to type "fix" seven times.
 */
import { useState } from 'react';
import { ENTITY_KINDS } from '../../../lib/entity-vocabulary';
import { LIVING_STATUSES } from '../../../lib/entity-vocabulary';
import type { EntityDetail } from '../../../lib/entity-detail';
import { formatLivingStatusLabel } from '../living-status-label';
import { FieldForm } from './FieldForm';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

/**
 * `sensitivityClasses` arrives as a prop rather than an import: the vocabulary lives in
 * `@repo/domain`, which is server-only (it pulls `node:url` and friends), so importing it here
 * would drag Node built-ins into the browser bundle.
 */
export function EntityRecordEditor({
  entity,
  sensitivityClasses,
}: {
  readonly entity: EntityDetail;
  readonly sensitivityClasses: readonly string[];
}) {
  const [reason, setReason] = useState('');
  const reasonGiven = reason.trim().length > 0;

  return (
    <section className="entity-edit" aria-label="Edit record">
      <div className="entity-edit__reason">
        <label className="story-review__field" htmlFor="entity-edit-reason">
          <span>Reason for this change</span>
          <input
            id="entity-edit-reason"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What source or correction is this based on?"
            required
          />
        </label>
        <p className="entity-edit__hint ds-sans">
          Recorded on the audit event with your identity and the before/after values. Every save
          below needs it.
        </p>
      </div>

      <h2 className="ds-section__title">Display name</h2>
      <FieldForm entityId={entity.id} field="displayName" reason={reason} disabled={!reasonGiven}>
        <label className="story-review__field">
          <span>Name</span>
          <input type="text" name="value" defaultValue={entity.displayName} required />
        </label>
      </FieldForm>

      <h2 className="ds-section__title">Kind</h2>
      <FieldForm entityId={entity.id} field="kind" reason={reason} disabled={!reasonGiven}>
        <label className="story-review__field">
          <span>Kind</span>
          <select name="value" defaultValue={entity.kind}>
            {ENTITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {titleCase(kind)}
              </option>
            ))}
          </select>
        </label>
        <p className="entity-edit__hint ds-sans">
          Class follows kind automatically — changing kind moves this record between the
          workbench&rsquo;s class facets.
        </p>
      </FieldForm>

      <h2 className="ds-section__title">Living status</h2>
      <FieldForm entityId={entity.id} field="livingStatus" reason={reason} disabled={!reasonGiven}>
        <label className="story-review__field">
          <span>Status</span>
          <select name="value" defaultValue={entity.livingStatus}>
            {LIVING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLivingStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </FieldForm>

      <h2 className="ds-section__title">Aliases</h2>
      <FieldForm entityId={entity.id} field="aliases" reason={reason} disabled={!reasonGiven}>
        <label className="story-review__field">
          <span>One alias per line</span>
          <textarea name="value" rows={4} defaultValue={entity.aliases.join('\n')} />
        </label>
        <p className="entity-edit__hint ds-sans">
          Commas stay inside a name (&ldquo;Chicago, Illinois&rdquo;), so they are never treated as
          separators.
        </p>
      </FieldForm>

      <h2 className="ds-section__title">Sensitivity</h2>
      <FieldForm entityId={entity.id} field="sensitivity" reason={reason} disabled={!reasonGiven}>
        <fieldset className="entity-edit__checks">
          <legend>Classes</legend>
          {sensitivityClasses.map((sensitivityClass) => (
            <label key={sensitivityClass} className="entity-edit__check">
              <input
                type="checkbox"
                name="sensitivity"
                value={sensitivityClass}
                defaultChecked={entity.sensitivity.some((entry) => entry.class === sensitivityClass)}
              />
              <span>{titleCase(sensitivityClass)}</span>
            </label>
          ))}
        </fieldset>
        <p className="entity-edit__hint ds-sans">
          Saving replaces the whole set — unchecking a class removes it.
        </p>
      </FieldForm>

      <h2 className="ds-section__title">Identifiers</h2>
      {entity.identifiers.length === 0 ? (
        <p className="ds-sans">No identifiers recorded.</p>
      ) : (
        <ul className="entity-edit__list">
          {entity.identifiers.map((identifier) => (
            <li key={identifier.id} className="entity-edit__list-row">
              <span className="ds-mono">
                {identifier.namespace} — {identifier.value}
                {identifier.trusted ? ' · trusted' : ''}
              </span>
              <FieldForm
                entityId={entity.id}
                field="identifierRemove"
                reason={reason}
                submitLabel="Remove"
                disabled={!reasonGiven}
              >
                <input type="hidden" name="identifierId" value={identifier.id} />
              </FieldForm>
            </li>
          ))}
        </ul>
      )}

      <FieldForm
        entityId={entity.id}
        field="identifierAdd"
        reason={reason}
        submitLabel="Add identifier"
        disabled={!reasonGiven}
      >
        <label className="story-review__field">
          <span>Namespace</span>
          <input type="text" name="namespace" placeholder="wikidata, lcnaf, viaf…" />
        </label>
        <label className="story-review__field">
          <span>Value</span>
          <input type="text" name="identifierValue" placeholder="Q4547697" />
        </label>
        <label className="entity-edit__check">
          <input type="checkbox" name="trusted" />
          <span>Trusted</span>
        </label>
        <p className="entity-edit__hint ds-sans">
          Identifiers are unique across the whole archive — one already pointing at another entity
          is refused rather than moved.
        </p>
      </FieldForm>
    </section>
  );
}
