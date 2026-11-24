'use client';

/**
 * The one confirmation for staff decisions that are terminal or reach outside the desk (a
 * rejected submission, a merged case). Reversible actions stay at one click and do not use this:
 * a confirmation on everything trains people to click through the one that matters.
 */
import { Dialog, buttonClassName } from '@repo/ui';
import React, { useEffect, useRef, useState } from 'react';

void React;

export type ConfirmActionRequest = {
  /** The action's verb, as its button reads: "Reject", "Merge". */
  readonly verb: string;
  /** Words that finish the verb after its object: "as spam". */
  readonly tail?: string;
  /** What the action lands on, singular: "submission", "case". */
  readonly noun: string;
  /** The object's human name. Used for a single object; a bulk action shows its count instead. */
  readonly name?: string;
  readonly count?: number;
  /** One plain sentence: what cannot be undone, and whether anyone is emailed. */
  readonly consequence: string;
  readonly onConfirm: () => void;
  /** The button that asked. Focus goes back to it on Cancel. */
  readonly trigger?: HTMLElement | null;
};

/** The title names the action and its object; the confirm button repeats the verb, never "OK". */
export function confirmActionCopy(
  request: Pick<ConfirmActionRequest, 'verb' | 'tail' | 'noun' | 'name' | 'count'>,
): { readonly title: string; readonly confirmLabel: string } {
  const tail = request.tail ? ` ${request.tail}` : '';
  const count = request.count ?? 1;
  const object = count === 1 ? request.noun : `${count.toLocaleString('en-US')} ${request.noun}s`;
  const confirmLabel = `${request.verb} ${object}${tail}`;
  const title =
    count === 1 && request.name ? `${request.verb} “${request.name}”${tail}?` : `${confirmLabel}?`;
  return { title, confirmLabel };
}

/** Cancel only dismisses. Confirm dismisses, then runs the action the pressed button stood for. */
export function confirmActionHandlers(
  request: Pick<ConfirmActionRequest, 'onConfirm'>,
  onDismiss: () => void,
): { readonly cancel: () => void; readonly confirm: () => void } {
  return {
    cancel: onDismiss,
    confirm: () => {
      onDismiss();
      request.onConfirm();
    },
  };
}

export function ConfirmAction({
  request,
  onDismiss,
}: {
  /** The pending confirmation, or null when nothing is being asked. Hold it in state. */
  readonly request: ConfirmActionRequest | null;
  readonly onDismiss: () => void;
}) {
  // The last request stays rendered while the dialog closes, so its title does not blank out.
  const [shown, setShown] = useState(request);
  if (request && request !== shown) setShown(request);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);

  // Runs after Dialog's own effect has called showModal(), which would focus the close button.
  useEffect(() => {
    if (!request) return;
    confirmedRef.current = false;
    cancelRef.current?.focus();
  }, [request]);

  if (!shown) return null;
  const { title, confirmLabel } = confirmActionCopy(shown);
  const { cancel, confirm } = confirmActionHandlers(shown, onDismiss);

  return (
    <Dialog
      open={request !== null}
      title={title}
      onClose={() => {
        // Escape and the close button arrive here with the dialog still open: treat as Cancel.
        if (request) cancel();
        // The native close event: the page is no longer inert, so the trigger can take focus.
        else if (!confirmedRef.current) shown.trigger?.focus();
      }}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            className={buttonClassName('secondary')}
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonClassName('primary')}
            onClick={() => {
              confirmedRef.current = true;
              confirm();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{shown.consequence}</p>
    </Dialog>
  );
}
