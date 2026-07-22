/**
 * Correction-submission sheet (MOB-016) — a modal route (`presentation: 'modal'`),
 * reachable from the More tab and from an entity record's correction CTA.
 *
 * Program invariant 7 / MOB-016 requirement #5: correction content and the
 * receipt code are NEVER encoded in a URL parameter. The only route params this
 * screen accepts are an optional `entityId` (context — which record the
 * correction is about, validated exactly as the entity detail route does) and an
 * optional `returnTo` (validated against the safe-route allowlist). The
 * correction text, contact details, and the returned receipt code live ONLY in
 * local component / feature state — there is no `router.push`/`setParams` call
 * anywhere near the free-text fields or the receipt, by design. Navigation to
 * the status screen carries no receipt (the user re-enters it there).
 *
 * Draft policy (MOB-016 requirement #6): form content is in-memory only for the
 * life of this modal. It is deliberately NOT persisted across app restarts — the
 * simplest safe choice, so correction content never touches the general cache.
 *
 * App Check posture (requirement #2): submission FAILS CLOSED — if no attestation
 * token can be obtained the write is not sent and the form shows a "try again"
 * notice (see the corrections client). Reads/status lookups do not.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { parseEntityId, parseReturnTo } from '../_lib/route-params';
import {
  CorrectionForm,
  CorrectionReceipt,
  createCorrectionClientDeps,
  submitCorrection,
  type CorrectionClientDeps,
  type CorrectionFormState,
  type SubmitResult,
} from '@/features/corrections';

export default function CorrectionsSubmitSheet() {
  const params = useLocalSearchParams<{ entityId?: string | string[]; returnTo?: string | string[] }>();
  const entityId = parseEntityId(params.entityId);
  const safeReturnTo = parseReturnTo(params.returnTo) ?? '/more';

  // The receipt is held only in local state — never in a route/URL param.
  const [receiptCode, setReceiptCode] = useState<string | null>(null);

  // Lazily build the transport deps (App Check token provider, SecureStore,
  // connectivity). Held in a ref-like memo so the native backends load once.
  const depsPromise = useMemo(() => createCorrectionClientDeps(), []);

  async function handleSubmit(state: CorrectionFormState): Promise<SubmitResult> {
    const deps: CorrectionClientDeps = await depsPromise;
    return submitCorrection(state, deps);
  }

  if (receiptCode) {
    return (
      <CorrectionReceipt
        receiptCode={receiptCode}
        onCheckStatus={() => router.replace('/corrections/status')}
        onDone={() => router.replace(safeReturnTo as never)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CorrectionForm
        entityId={entityId ?? undefined}
        onSubmit={handleSubmit}
        onAccepted={(code) => setReceiptCode(code)}
      />
    </View>
  );
}
