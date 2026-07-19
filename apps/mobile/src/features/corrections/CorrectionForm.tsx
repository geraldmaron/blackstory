/**
 * Correction intake form (MOB-016 #1). Category/target pickers, description,
 * a required HTTPS evidence URL, optional contact with an AFFIRMATIVE (never
 * pre-checked) contact-consent step, and the required privacy-notice consent.
 *
 * All field state is in-memory only for the lifetime of the modal — it is
 * deliberately NOT persisted across app restarts (MOB-016 #6: no encrypted
 * draft feature; the simplest safe choice is no on-disk draft, so correction
 * content never touches the general cache). Nothing here is passed through the
 * router / a URL param (invariant 7).
 */
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Notice, Text, radius, space, useThemeColors } from '@/ui';
import type { SubmitResult } from './client';
import {
  CONTACT_CONSENT_LABEL,
  CORRECTION_FORM_INTRO,
  CORRECTION_PRIVACY_NOTICE,
  PRIVACY_CONSENT_LABEL,
  APP_CHECK_UNAVAILABLE_MESSAGE,
  GENERIC_SUBMIT_ERROR,
  OFFLINE_MESSAGE,
  RATE_LIMITED_MESSAGE,
} from './copy';
import {
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  type CorrectionCategory,
  type CorrectionTargetType,
} from './categories';
import {
  EMPTY_CORRECTION_FORM,
  MAX_CONTACT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_SOURCE_URL_LENGTH,
  MAX_TARGET_ID_LENGTH,
  validateCorrectionForm,
  type CorrectionFieldIssue,
  type CorrectionFormState,
} from './validation';

export type CorrectionFormProps = {
  /** Optional record context — pre-fills the target id (validated upstream). */
  readonly entityId?: string | undefined;
  /** Network submit — injected by the route so the form stays transport-free. */
  readonly onSubmit: (state: CorrectionFormState) => Promise<SubmitResult>;
  /** Called with the opaque receipt once the server accepts the submission. */
  readonly onAccepted: (receiptCode: string) => void;
};

function issueFor(issues: readonly CorrectionFieldIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

export function CorrectionForm({ entityId, onSubmit, onAccepted }: CorrectionFormProps) {
  const theme = useThemeColors();
  const [state, setState] = useState<CorrectionFormState>({
    ...EMPTY_CORRECTION_FORM,
    targetRecordId: entityId ?? '',
    ...(entityId ? { targetType: 'entity' as const } : {}),
  });
  const [issues, setIssues] = useState<readonly CorrectionFieldIssue[]>([]);
  const [banner, setBanner] = useState<{ tone: 'error' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function patch(next: Partial<CorrectionFormState>) {
    setState((prev) => ({ ...prev, ...next }));
  }

  async function handleSubmit() {
    setBanner(null);
    const local = validateCorrectionForm(state);
    if (!local.valid) {
      setIssues(local.issues);
      return;
    }
    setIssues([]);
    setBusy(true);
    try {
      const result = await onSubmit(state);
      switch (result.status) {
        case 'accepted':
          onAccepted(result.receiptCode);
          return;
        case 'invalid':
          setIssues(result.issues);
          return;
        case 'offline':
          setBanner({ tone: 'warning', text: OFFLINE_MESSAGE });
          return;
        case 'app_check_unavailable':
          setBanner({ tone: 'warning', text: APP_CHECK_UNAVAILABLE_MESSAGE });
          return;
        case 'rate_limited':
          setBanner({ tone: 'warning', text: RATE_LIMITED_MESSAGE });
          return;
        default:
          setBanner({ tone: 'error', text: GENERIC_SUBMIT_ERROR });
      }
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.sm,
    padding: space['3'],
    color: theme.ink,
  } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: space['4'], gap: space['4'] }} keyboardShouldPersistTaps="handled">
      <Text variant="bodySmall" colorRole="inkMuted">
        {CORRECTION_FORM_INTRO}
      </Text>

      <Notice tone="info" title={CORRECTION_PRIVACY_NOTICE.title} description={CORRECTION_PRIVACY_NOTICE.body} />

      <Field label="What are you correcting?" error={issueFor(issues, 'targetType')}>
        <ChipRow<CorrectionTargetType>
          values={Object.keys(CORRECTION_TARGET_LABELS) as CorrectionTargetType[]}
          selected={state.targetType || undefined}
          labelFor={(v) => CORRECTION_TARGET_LABELS[v]}
          onSelect={(v) => patch({ targetType: v })}
        />
      </Field>

      <Field label="Category" error={issueFor(issues, 'category')}>
        <ChipRow<CorrectionCategory>
          values={Object.keys(CORRECTION_CATEGORY_LABELS) as CorrectionCategory[]}
          selected={state.category || undefined}
          labelFor={(v) => CORRECTION_CATEGORY_LABELS[v]}
          onSelect={(v) => patch({ category: v })}
        />
      </Field>

      <Field label="Record identifier" error={issueFor(issues, 'targetRecordId')}>
        <TextInput
          value={state.targetRecordId}
          onChangeText={(t) => patch({ targetRecordId: t })}
          placeholder="e.g. ent_caam_los_angeles_001"
          placeholderTextColor={theme.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX_TARGET_ID_LENGTH}
          accessibilityLabel="Record identifier"
          style={inputStyle}
        />
      </Field>

      <Field label="Describe the correction" error={issueFor(issues, 'statement')}>
        <TextInput
          value={state.statement}
          onChangeText={(t) => patch({ statement: t })}
          placeholder="What is wrong, and what should it say?"
          placeholderTextColor={theme.inkMuted}
          multiline
          numberOfLines={6}
          maxLength={MAX_FIELD_LENGTH}
          accessibilityLabel="Correction details"
          style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
        />
      </Field>

      <Field label="Supporting HTTPS source URL" error={issueFor(issues, 'sourceUrl')}>
        <TextInput
          value={state.sourceUrl}
          onChangeText={(t) => patch({ sourceUrl: t })}
          placeholder="https://…"
          placeholderTextColor={theme.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={MAX_SOURCE_URL_LENGTH}
          accessibilityLabel="Supporting HTTPS source URL"
          style={inputStyle}
        />
      </Field>

      <Field label="Contact (optional)" error={issueFor(issues, 'contact')}>
        <TextInput
          value={state.contact}
          onChangeText={(t) => patch({ contact: t })}
          placeholder="Email or handle, only if you want a reply"
          placeholderTextColor={theme.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX_CONTACT_LENGTH}
          accessibilityLabel="Contact details (optional)"
          style={inputStyle}
        />
      </Field>

      <Checkbox
        checked={state.contactConsent}
        onToggle={() => patch({ contactConsent: !state.contactConsent })}
        label={CONTACT_CONSENT_LABEL}
        error={issueFor(issues, 'contactConsent')}
      />

      <Checkbox
        checked={state.privacyConsent}
        onToggle={() => patch({ privacyConsent: !state.privacyConsent })}
        label={PRIVACY_CONSENT_LABEL}
        error={issueFor(issues, 'privacyConsent')}
      />

      {banner ? <Notice tone={banner.tone} title="Not submitted" description={banner.text} /> : null}

      <Button label="Submit correction" variant="primary" loading={busy} onPress={handleSubmit} />
    </ScrollView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  readonly label: string;
  readonly error?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space['1'] }}>
      <Text variant="bodyEmphasis">{label}</Text>
      {children}
      {error ? (
        <Text variant="bodySmall" colorRole="accent" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ChipRow<T extends string>({
  values,
  selected,
  labelFor,
  onSelect,
}: {
  readonly values: readonly T[];
  readonly selected: T | undefined;
  readonly labelFor: (value: T) => string;
  readonly onSelect: (value: T) => void;
}) {
  const theme = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space['2'] }}>
      {values.map((value) => {
        const isSelected = value === selected;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(value)}
            style={{
              borderWidth: 1,
              borderColor: isSelected ? theme.accent : theme.border,
              backgroundColor: isSelected ? theme.surfaceRaised : 'transparent',
              borderRadius: radius.sm,
              paddingVertical: space['2'],
              paddingHorizontal: space['3'],
            }}
          >
            <Text variant="bodySmall" colorRole={isSelected ? 'accent' : 'ink'}>
              {labelFor(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
  error,
}: {
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly label: string;
  readonly error?: string | undefined;
}) {
  const theme = useThemeColors();
  return (
    <View style={{ gap: space['1'] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={onToggle}
        style={{ flexDirection: 'row', gap: space['3'], alignItems: 'flex-start' }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: checked ? theme.accent : theme.border,
            backgroundColor: checked ? theme.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Text variant="bodySmall" style={{ color: theme.inverseInk }}>
              ✓
            </Text>
          ) : null}
        </View>
        <Text variant="bodySmall" style={{ flex: 1 }}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="bodySmall" colorRole="accent" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
