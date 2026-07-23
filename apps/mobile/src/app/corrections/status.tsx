/**
 * Correction status-lookup screen (MOB-016 requirement #4).
 *
 * The user enters the opaque receipt code they saved at submission time; the
 * coarse public phase (received / under review / closed) is returned. There is
 * NO browse/enumerate surface — a status can only be reached with the exact
 * code (mirrors web's `receipt-code.ts` / `public-status.ts`).
 *
 * Invariant 7 / requirement #5: the receipt code is NEVER read from or written
 * to a route/URL param. This screen accepts no route params carrying a receipt;
 * the code lives only in the status view's in-memory field and the POST body of
 * the lookup. It is pre-filled (best effort) from SecureStore, not from a URL.
 */
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import {
  CorrectionStatusView,
  createCorrectionClientDeps,
  lookupCorrectionStatus,
  readStoredReceiptCode,
  type CorrectionClientDeps,
  type StatusResult,
} from '@/features/corrections';
import { UtilityScreenShell } from '@/ui';

export default function CorrectionsStatusScreen() {
  const depsPromise = useMemo(() => createCorrectionClientDeps(), []);
  const [initialCode, setInitialCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    depsPromise
      .then((deps) => readStoredReceiptCode(deps.secrets))
      .then((code) => {
        if (active && code) setInitialCode(code);
      })
      .catch(() => {
        // A missing/failed SecureStore read is non-fatal — the user can type
        // the code. Never surfaces or logs the receipt.
      });
    return () => {
      active = false;
    };
  }, [depsPromise]);

  async function handleLookup(receiptCode: string): Promise<StatusResult> {
    const deps: CorrectionClientDeps = await depsPromise;
    return lookupCorrectionStatus(receiptCode, deps);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <UtilityScreenShell
        kicker="Trust"
        title="Correction status"
        dek="Enter the receipt code you saved when you submitted a correction."
        edges={SHELL_EDGES}
        scrollProps={UTILITY_SCROLL_PROPS}
      >
        <CorrectionStatusView initialCode={initialCode} onLookup={handleLookup} />
      </UtilityScreenShell>
    </KeyboardAvoidingView>
  );
}

/** Header-bearing stack screen: the native header owns the top inset. */
const SHELL_EDGES = ['left', 'right', 'bottom'] as const;

const UTILITY_SCROLL_PROPS = {
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: 'on-drag' as const,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
