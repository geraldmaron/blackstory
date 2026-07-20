/**
 * Modal dialog built on the native <dialog> element with Escape close and labelled title.
 */

'use client';

import React, { useEffect, useId, useRef, type ReactNode } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import { cx } from '../utils/cx.js';

export type DialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly footer?: ReactNode;
  readonly className?: string;
};

export function Dialog({ open, title, children, onClose, footer, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cx('ds-dialog', className)}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="ds-dialog__header">
        <h2 className="ds-dialog__title" id={titleId}>
          {title}
        </h2>
        <button
          type="button"
          className="ds-dialog__close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      <div className="ds-dialog__body">{children}</div>
      {footer ? <div className="ds-dialog__footer">{footer}</div> : null}
    </dialog>
  );
}
