/**
 * Content notes under the lede: one quiet line plus a disclosure, never a warning box.
 *
 * `EntitySensitivityNote` is for a sensitivity-flagged record (the entity's conduct history).
 * `TraumaContentNote` is for a record whose accepted prose documents harm (`deriveTraumaContentNotice`
 * in `@repo/domain`); a page shows one or the other, since both carry the same disclaimer.
 *
 * Include-with-context, never suppression: this renders alongside the record and has no way to
 * hide it. The class label and the reviewer's conduct-based note lead; the registry's
 * sensitive-content disclaimer (and, for a person, the non-endorsement disclaimer) follow in a
 * disclosure, still in the HTML. Copy comes from `@repo/domain`'s versioned registry.
 */
import React from 'react';
import { getDisclaimer, SENSITIVITY_CLASS_PRESENTATION_LABELS } from '@repo/domain/disclaimers';
import type { EntityKind } from '@repo/domain/entity-kinds';
import type { EntitySensitivity } from '@repo/domain/entity-status';
import type { DisclaimerRecord } from '@repo/domain';

void React;

export type EntitySensitivityNoteProps = {
  readonly sensitivity: EntitySensitivity;
  readonly entityKind: EntityKind;
};

export function EntitySensitivityNote({ sensitivity, entityKind }: EntitySensitivityNoteProps) {
  const label = SENSITIVITY_CLASS_PRESENTATION_LABELS[sensitivity.class];
  const nonEndorsement = entityKind === 'person' ? getDisclaimer('non_endorsement') : undefined;
  return (
    <>
      <span>
        <strong>{label}.</strong> {sensitivity.note}
      </span>
      <details className="ds-recpage__note-more">
        <summary>
          <span className="ds-recpage__note-toggle">How this record is presented</span>
        </summary>
        <p>{getDisclaimer('sensitive_content').body}</p>
        {nonEndorsement ? (
          <p>
            <strong>{nonEndorsement.title}.</strong> {nonEndorsement.body}
          </p>
        ) : null}
      </details>
    </>
  );
}

export function TraumaContentNote({ disclaimer }: { readonly disclaimer: DisclaimerRecord }) {
  return (
    <details className="ds-recpage__note-more">
      <summary>
        <strong>{`${disclaimer.title}.`}</strong>&nbsp;
        <span className="ds-recpage__note-toggle">How this record is presented</span>
      </summary>
      <p>{disclaimer.body}</p>
    </details>
  );
}
