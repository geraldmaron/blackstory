/**
 * Toast stack for the Explore surface. Bottom centre, above the Time panel.
 *
 * `role="status"` + `aria-live="polite"` on the region, not on each toast, so a screen reader
 * announces new entries without re-reading the whole stack. Toasts never carry the only copy of
 * an outcome: they confirm something the surface already shows.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@repo/ui';
import {
  dismissToast,
  latestActionableToast,
  pushToast,
  toastDurationMs,
  type ToastAction,
  type ToastSpec,
} from './toast-stack';
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
    const duration = toastDurationMs(toast);
    // Null means this toast carries an action and waits for the reader. No timer is started at
    // all, rather than a very long one: a long timer is still a deadline, just a hidden one.
    if (duration === null) return;
    const timer = setTimeout(dismiss, duration);
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
  /** Runs the newest actionable toast's action and dismisses it. No-op when there is none. */
  readonly runLatestAction: () => void;
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

  /**
   * The keyboard route to an action toast.
   *
   * Persisting the toast is only half of it: a toast that waits forever but can only be reached by
   * pointing at a small button in the corner still excludes the readers the persistence was for.
   *
   * Reads the stack through a ref rather than from inside a `setToasts` updater. React may invoke
   * an updater more than once, and `action.run()` is a side effect — undoing twice is worse than
   * not undoing at all. The ref also keeps this callback referentially stable for callers that
   * list it in a dependency array.
   */
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const runLatestAction = useCallback(() => {
    const toast = latestActionableToast(toastsRef.current);
    if (!toast?.action) return;
    toast.action.run();
    dismiss(toast.id);
  }, [dismiss]);

  return { toasts, show, dismiss, runLatestAction };
}
