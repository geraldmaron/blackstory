/**
 * Toast stack for the Atlas surface. Bottom centre, above the Time panel.
 *
 * `role="status"` + `aria-live="polite"` on the region, not on each toast, so a screen reader
 * announces new entries without re-reading the whole stack. Toasts never carry the only copy of
 * an outcome: they confirm something the surface already shows.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { cx } from '@repo/ui';
import {
  dismissToast,
  pushToast,
  toastDurationMs,
  type ToastAction,
  type ToastSpec,
} from './toast';
import './toast.css';

void React;

export type ToastStackProps = {
  readonly toasts: readonly ToastSpec[];
  readonly onDismiss: (id: string) => void;
  readonly className?: string;
};

function ToastRow({ toast, onDismiss }: { toast: ToastSpec; onDismiss: (id: string) => void }) {
  const dismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);
  const runAction = useCallback(
    (action: ToastAction) => {
      action.run();
      onDismiss(toast.id);
    },
    [onDismiss, toast.id],
  );

  useEffect(() => {
    const timer = setTimeout(dismiss, toastDurationMs(toast));
    return () => clearTimeout(timer);
  }, [dismiss, toast]);

  return (
    <div className="ds-toast">
      <p className="ds-toast__message">{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          className="ds-toast__action"
          onClick={() => toast.action && runAction(toast.action)}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" className="ds-toast__close" onClick={dismiss} aria-label="Dismiss">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss, className }: ToastStackProps) {
  return (
    <div
      className={cx('ds-toast-stack', className)}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export type UseToasts = {
  readonly toasts: readonly ToastSpec[];
  readonly show: (toast: ToastSpec) => void;
  readonly dismiss: (id: string) => void;
};

/** Owns the toast stack for a surface. One per surface — toasts are not a global singleton. */
export function useToasts(): UseToasts {
  const [toasts, setToasts] = useState<readonly ToastSpec[]>([]);

  // Both callbacks update through the functional form, so they stay referentially stable and are
  // safe to list in a caller's dependency array.
  const show = useCallback((toast: ToastSpec) => {
    setToasts((current) => pushToast(current, toast));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => dismissToast(current, id));
  }, []);

  return { toasts, show, dismiss };
}
