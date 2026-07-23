/**
 * Correction status lookup view (MOB-016 #4). The user types their opaque
 * receipt code; the coarse public phase (received / under review / closed) is
 * shown. Rate-limit and not-found messages are NON-REVEALING — they never
 * disclose moderation state or whether a code once existed (requirement #4/#7),
 * mirroring web's `public-status.ts` / `rate-limit-guard.ts` behavior.
 *
 * The receipt code lives only in this component's in-memory state and the POST
 * body of the lookup — it is never placed in the app's route/URL (invariant 7).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Notice, Text, space } from '@/ui';
import { CorrectionTextField } from './CorrectionTextField';
import type { StatusResult } from './client';
import {
  PUBLIC_STATUS_LABELS,
  RATE_LIMITED_MESSAGE,
  STATUS_INVALID_CODE_MESSAGE,
  STATUS_NOT_FOUND_MESSAGE,
  STATUS_VOLUME_NOTICE,
} from './copy';
import { RECEIPT_CODE_PATTERN } from './receipt';

export type CorrectionStatusViewProps = {
  /** Optional pre-fill (e.g. the last stored receipt). */
  readonly initialCode?: string | undefined;
  readonly onLookup: (receiptCode: string) => Promise<StatusResult>;
};

export function CorrectionStatusView({ initialCode, onLookup }: CorrectionStatusViewProps) {
  const [code, setCode] = useState(initialCode ?? '');
  const [result, setResult] = useState<StatusResult | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = code.trim();
  const looksValid = RECEIPT_CODE_PATTERN.test(trimmed);

  async function handleLookup() {
    // Keep the button live even before the code matches the expected shape, and
    // surface the "check the code" guidance on press instead of silently doing
    // nothing (the first tap used to only dismiss the keyboard).
    if (!looksValid) {
      setResult({ status: 'invalid_code' });
      return;
    }
    setBusy(true);
    try {
      setResult(await onLookup(trimmed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space['3'] }}>
      <CorrectionTextField
        value={code}
        onChangeText={setCode}
        placeholder="BB-COR-…"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={64}
        returnKeyType="done"
        onSubmitEditing={handleLookup}
        accessibilityLabel="Correction receipt code"
        invalid={result?.status === 'invalid_code'}
      />
      <Text variant="bodySmall" colorRole="inkMuted">
        Codes look like BB-COR-XXXXXXXXXXXXXXXX.
      </Text>

      <Button label="Check status" variant="primary" loading={busy} onPress={handleLookup} />

      {result ? <StatusOutcome result={result} /> : null}
    </View>
  );
}

function StatusOutcome({ result }: { readonly result: StatusResult }) {
  switch (result.status) {
    case 'found':
      return (
        <View style={{ gap: space['2'] }}>
          <Notice
            tone="info"
            title={`Status: ${PUBLIC_STATUS_LABELS[result.correction.phase]}`}
            description={`Submitted ${result.correction.submittedAt} · Last updated ${result.correction.updatedAt}`}
          />
          <Text variant="bodySmall" colorRole="inkMuted">
            {STATUS_VOLUME_NOTICE}
          </Text>
        </View>
      );
    case 'not_found':
      return <Notice tone="warning" title="Not found" description={STATUS_NOT_FOUND_MESSAGE} />;
    case 'invalid_code':
      return <Notice tone="warning" title="Check the code" description={STATUS_INVALID_CODE_MESSAGE} />;
    case 'offline':
      return (
        <Notice
          tone="warning"
          title="You’re offline"
          description="Reconnect to check your correction’s status."
        />
      );
    case 'rate_limited':
      return <Notice tone="warning" title="Slow down" description={RATE_LIMITED_MESSAGE} />;
    default:
      return <Notice tone="error" title="Something went wrong" description="Please try again." />;
  }
}
