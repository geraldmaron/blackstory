/**
 * Correction-submission modal. Only validated entityId and returnTo values enter route
 * parameters. Correction text, contact details and receipt codes stay in component state and
 * are not persisted across restarts or embedded in URLs. Submission uses the shared
 * client-header protocol and server validation; the header does not establish identity.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { parseEntityId, parseReturnTo } from '@/lib/route-params';
import {
  CorrectionForm,
  CorrectionReceipt,
  createCorrectionClientDeps,
  submitCorrection,
  type CorrectionClientDeps,
  type CorrectionFormState,
  type SubmitResult,
} from '@/features/corrections';
import { UtilityScreenShell } from '@/ui';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function CorrectionsSubmitSheet() {
  const params = useLocalSearchParams<{
    entityId?: string | string[];
    returnTo?: string | string[];
  }>();
  const entityId = parseEntityId(params.entityId);
  const safeReturnTo = parseReturnTo(params.returnTo) ?? '/more';

  useEditionStackBack({
    fallbackHref: safeReturnTo,
    accessibilityHint: 'Closes this sheet when there is no previous screen',
  });

  // The receipt is held only in local state — never in a route/URL param.
  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Memoize transport, secure storage and connectivity dependencies so native backends
  // initialize once.
  const depsPromise = useMemo(() => createCorrectionClientDeps(), []);

  async function handleSubmit(state: CorrectionFormState): Promise<SubmitResult> {
    const deps: CorrectionClientDeps = await depsPromise;
    return submitCorrection(state, deps);
  }

  if (receiptCode) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Title left to the Notice inside CorrectionReceipt (which also carries the
            assistive-tech focus/announcement); the shell header stays distinct. */}
        <UtilityScreenShell
          ref={scrollRef}
          kicker="Trust"
          title="Correction submitted"
          edges={SHELL_EDGES}
          scrollProps={UTILITY_SCROLL_PROPS}
        >
          <CorrectionReceipt
            receiptCode={receiptCode}
            onCheckStatus={() => router.replace('/corrections/status')}
            onDone={() => router.replace(safeReturnTo as never)}
          />
        </UtilityScreenShell>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <UtilityScreenShell
        ref={scrollRef}
        kicker="Trust"
        title="Submit a correction"
        dek="Say what should change and link to evidence someone else can check."
        edges={SHELL_EDGES}
        scrollProps={UTILITY_SCROLL_PROPS}
      >
        <CorrectionForm
          entityId={entityId ?? undefined}
          scrollRef={scrollRef}
          onSubmit={handleSubmit}
          onAccepted={(code) => setReceiptCode(code)}
        />
      </UtilityScreenShell>
    </KeyboardAvoidingView>
  );
}

/** Header-bearing modal: the native header owns the top inset, so the canvas only
 * insets the sides and bottom (not a tab-screen top inset). */
const SHELL_EDGES = ['left', 'right', 'bottom'] as const;

const UTILITY_SCROLL_PROPS = {
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: 'on-drag' as const,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
